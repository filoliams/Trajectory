/**
 * Changes waiting to be saved to Supabase, kept on the device so they survive
 * closing the app with no network. Sent in order whenever we're online.
 *
 * Rows made offline get a temporary id ("tmp-…"). Once the row is saved, later
 * changes that mention the temporary id are sent with the real one.
 *
 * Conflicts: every change carries the time it was made. An update only applies
 * if the row hasn't been edited more recently (e.g. on another device), so the
 * latest edit wins. Updates to rows deleted elsewhere quietly do nothing.
 */
import { supabase } from '@/lib/supabase';

import { readJson, writeJson } from './storage';

export type Table = 'profiles' | 'courses' | 'assessments' | 'topics' | 'quiz_attempts';
type Values = Record<string, unknown>;

export type Op = { id: string; at: number } & (
  | { kind: 'insert'; table: Table; tempId: string; values: Values }
  | { kind: 'update'; table: Table; rowId: string; values: Values }
  | { kind: 'delete'; table: Table; rowId: string }
  | { kind: 'rpc'; fn: 'add_study_time'; args: Values }
);

/** An Op before it's queued: the outbox fills in its id and time. */
export type NewOp = Op extends infer O ? (O extends Op ? Omit<O, 'id' | 'at'> : never) : never;

/** `parked`: changes for a table or function the database doesn't have yet (migration not run). Retried on every flush. */
type Saved = { ops: Op[]; parked?: Op[]; ids: Record<string, string>; lastAt: number };

export type FlushResult = { offline: boolean; sent: number; rejected: string[]; parked: number };

/** Tables with an updated_at column (see the sync migration). */
const STAMPED: Table[] = ['courses', 'assessments', 'topics'];
const UNRESOLVED = Symbol('unresolved');

export function tempId(): string {
  return `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const isTemp = (id: string) => id.startsWith('tmp-');

/** A fetch that never reached the server (no network, DNS, server down). */
/** PostgREST / Postgres codes for "no such table or function". */
function isMissingSchema(error: { code?: string }) {
  return ['PGRST202', 'PGRST205', '42P01', '42883'].includes(error.code ?? '');
}

function isNetworkFailure(result: { status: number; error: { message: string } | null }) {
  return result.status === 0 || /failed to fetch|network request failed|load failed/i.test(result.error?.message ?? '');
}

export class Outbox {
  private key: string;
  private saved: Saved;
  private listeners = new Set<() => void>();
  private running: Promise<FlushResult> | null = null;
  /** Set if the sync migration hasn't been run yet, so updates are sent without edit times. */
  private unstamped = false;

  constructor(userId: string) {
    this.key = `trajectory.outbox.${userId}`;
    this.saved = readJson<Saved>(this.key) ?? { ops: [], ids: {}, lastAt: 0 };
  }

  get size() {
    return this.saved.ops.length;
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  add(op: NewOp) {
    // Strictly increasing, so two quick edits on this device never look "older" than each other.
    const at = Math.max(Date.now(), this.saved.lastAt + 1);
    this.saved.ops.push({ ...op, id: `${at}-${Math.random().toString(36).slice(2, 6)}`, at } as Op);
    this.saved.lastAt = at;
    this.save();
  }

  /** Send everything waiting. Safe to call often; overlapping calls share one run. */
  flush(): Promise<FlushResult> {
    this.running ??= this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private save() {
    if (!this.saved.ops.length && !this.saved.parked?.length) this.saved.ids = {};
    writeJson(this.key, this.saved);
    this.listeners.forEach((fn) => fn());
  }

  private async run(): Promise<FlushResult> {
    const result: FlushResult = { offline: false, sent: 0, rejected: [], parked: 0 };
    // Give parked changes another go, in case the migration has been run since.
    if (this.saved.parked?.length) {
      this.saved.ops = [...this.saved.parked, ...this.saved.ops];
      this.saved.parked = [];
    }
    const parked: Op[] = [];
    while (this.saved.ops.length) {
      const op = this.saved.ops[0];
      const outcome = await this.send(op);
      if (outcome === 'offline') {
        result.offline = true;
        break;
      }
      if (outcome === 'missing') parked.push(op);
      else if (typeof outcome === 'string') result.rejected.push(outcome);
      else result.sent += 1;
      this.saved.ops.shift();
      this.save();
    }
    this.saved.parked = [...parked, ...(this.saved.parked ?? [])];
    result.parked = this.saved.parked.length;
    this.save();
    return result;
  }

  /** Real id for a temporary one; UNRESOLVED if the row it belonged to was never saved. */
  private resolve(value: unknown): unknown {
    if (typeof value !== 'string' || !isTemp(value)) return value;
    const real = this.saved.ids[value];
    if (real === undefined) return UNRESOLVED;
    return /^\d+$/.test(real) ? Number(real) : real;
  }

  private resolveAll(values: Values): Values | typeof UNRESOLVED {
    const out: Values = {};
    for (const [k, v] of Object.entries(values)) {
      const r = this.resolve(v);
      if (r === UNRESOLVED) return UNRESOLVED;
      out[k] = r;
    }
    return out;
  }

  /** true = saved (or nothing to do), 'offline' = try later, 'missing' = park it, string = the server said no. */
  private async send(op: Op): Promise<true | 'offline' | 'missing' | string> {
    const stamp = !this.unstamped && op.kind !== 'rpc' && STAMPED.includes(op.table);
    const at = new Date(op.at).toISOString();
    const rowId = op.kind === 'update' || op.kind === 'delete' ? this.resolve(op.rowId) : null;
    const values = op.kind === 'delete' ? {} : this.resolveAll(op.kind === 'rpc' ? op.args : op.values);
    // Depends on a row that failed to save, so it can't apply either.
    if (rowId === UNRESOLVED || values === UNRESOLVED) return true;

    let res;
    if (op.kind === 'insert') {
      res = await supabase
        .from(op.table)
        .insert(stamp ? { ...values, updated_at: at } : values)
        .select('id')
        .single();
      if (!res.error && res.data) this.saved.ids[op.tempId] = String((res.data as { id: number | string }).id);
    } else if (op.kind === 'update') {
      let q = supabase
        .from(op.table)
        .update(stamp ? { ...values, updated_at: at } : values)
        .eq('id', rowId as string | number);
      if (stamp) q = q.lt('updated_at', at);
      res = await q;
    } else if (op.kind === 'delete') {
      res = await supabase.from(op.table).delete().eq('id', rowId as string | number);
    } else {
      res = await supabase.rpc(op.fn, values);
    }

    if (!res.error) return true;
    // 401: the login token expired while offline; wait for Supabase to refresh it rather than losing the change.
    if (isNetworkFailure(res) || res.status === 401) return 'offline';
    if (isMissingSchema(res.error)) return 'missing';
    // Database without the sync migration yet: send without edit times rather than failing.
    if (stamp && /updated_at/.test(res.error.message)) {
      this.unstamped = true;
      return this.send(op);
    }
    return res.error.message;
  }
}
