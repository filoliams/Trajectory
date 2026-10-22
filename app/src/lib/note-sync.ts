import { FunctionsHttpError } from '@supabase/supabase-js';
import type { DocumentPickerAsset } from 'expo-document-picker';

import { MAX_NOTE_BYTES, checkNoteFile, notePath, sha256Hex, type NoteOutcome } from '@/lib/note-files';
import { supabase } from '@/lib/supabase';
import { readJson, writeJson } from '@/lib/sync/storage';

const DEVICE_KEY = 'trajectory.deviceId';
const POLL_MS = 3_000;
const WAIT_MS = 5 * 60_000;

type Picked = { name: string; bytes: Uint8Array; contentType: string; path: string; hash: string; modifiedAt: string | null };
type CheckReply = { needed: { path: string; document_id: number; upload_path: string }[]; unchanged: string[] };

/**
 * Sends picked note files through the server pipeline for one course: hash check, upload only what
 * changed, analyse, then wait for each result. Topic levels arrive through the store's realtime sync.
 * Throws a plain sentence when the pipeline can't be reached at all.
 */
export async function analyseNotes(courseCode: string, assets: DocumentPickerAsset[]): Promise<NoteOutcome[]> {
  const outcomes: NoteOutcome[] = [];
  const picked: Picked[] = [];
  for (const asset of assets) {
    const check = checkNoteFile(asset.name, asset.size ?? 0);
    if ('reason' in check) {
      outcomes.push({ name: asset.name, status: 'skipped', reason: check.reason });
      continue;
    }
    const bytes = await bytesOf(asset);
    // The picker doesn't always report a size, so check the real one too.
    if (bytes.length > MAX_NOTE_BYTES) {
      outcomes.push({ name: asset.name, status: 'skipped', reason: 'This file is over 20 MB. Split it into smaller files.' });
      continue;
    }
    picked.push({
      name: asset.name,
      bytes,
      contentType: check.contentType,
      path: notePath(courseCode, asset.name),
      hash: sha256Hex(bytes),
      modifiedAt: asset.lastModified ? new Date(asset.lastModified).toISOString() : null,
    });
  }
  if (!picked.length) return outcomes;

  const reply = await call<CheckReply>('notes-check', {
    provider: 'files',
    device_id: deviceId(),
    files: picked.map((p) => ({ path: p.path, name: p.name, size: p.bytes.length, content_hash: p.hash, modified_at: p.modifiedAt })),
  });
  const byPath = new Map(picked.map((p) => [p.path, p]));
  for (const path of reply.unchanged) outcomes.push({ name: byPath.get(path)?.name ?? path, status: 'unchanged' });

  const started = new Map<number, string>();
  for (const need of reply.needed) {
    const file = byPath.get(need.path);
    if (!file) continue;
    const { error: uploadError } = await supabase.storage
      .from('notes')
      .upload(need.upload_path, file.bytes, { contentType: file.contentType, upsert: true });
    if (uploadError) {
      outcomes.push({ name: file.name, status: 'failed', reason: 'Couldn’t upload this file. Try again.' });
      continue;
    }
    try {
      await call('notes-ingest', { document_id: need.document_id });
      started.set(need.document_id, file.name);
    } catch (e) {
      outcomes.push({ name: file.name, status: 'failed', reason: e instanceof Error ? e.message : String(e) });
    }
  }

  return [...outcomes, ...(await waitForResults(started))];
}

/** Polls the started documents until each is finished, or reports the rest as still analysing. */
async function waitForResults(started: Map<number, string>): Promise<NoteOutcome[]> {
  const results = new Map<number, NoteOutcome>();
  const deadline = Date.now() + WAIT_MS;
  while (results.size < started.size && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    const pending = [...started.keys()].filter((id) => !results.has(id));
    const { data } = await supabase.from('documents').select('id, status, error').in('id', pending);
    for (const doc of data ?? []) {
      const name = started.get(doc.id)!;
      if (doc.status === 'done') results.set(doc.id, doc.error ? { name, status: 'failed', reason: doc.error } : { name, status: 'done' });
      if (doc.status === 'failed' || doc.status === 'skipped') results.set(doc.id, { name, status: doc.status, reason: doc.error ?? undefined });
    }
  }
  return [...started].map(([id, name]) => results.get(id) ?? { name, status: 'analysing' });
}

async function bytesOf(asset: DocumentPickerAsset): Promise<Uint8Array> {
  const buffer = asset.file ? await asset.file.arrayBuffer() : await (await fetch(asset.uri)).arrayBuffer();
  return new Uint8Array(buffer);
}

/** Calls an Edge Function and turns its error body into the sentence the function wrote. */
async function call<T = unknown>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const reply = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
    throw new Error(reply?.error ?? 'Note analysis isn’t available right now.');
  }
  return data as T;
}

/** A stable id for this install, so the server can tell this device's files apart from another's. */
function deviceId(): string {
  const saved = readJson<string>(DEVICE_KEY);
  if (saved) return saved;
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  writeJson(DEVICE_KEY, id);
  return id;
}
