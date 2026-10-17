import { useCallback, useEffect, useRef, useState } from 'react';

import { dayKey } from '@/lib/day';
import { useStore } from '@/lib/store';
import { readJson as read, writeJson as write } from '@/lib/sync/storage';

export { dayKey } from '@/lib/day';

export type StudyMode = 'idle' | 'study' | 'break';
export type CompanionKind = 'critter' | 'cat' | 'frog' | 'plant';

/**
 * The running timer stays on this device. Finished study time is saved to the
 * account (see addStudyTime in the store), so daily totals follow you across devices.
 */
type SessionState = {
  /** Brisbane date this session belongs to; a new day starts fresh. */
  day: string;
  activeId: string | null;
  mode: StudyMode;
  /** When the current study or break segment began. */
  since: number | null;
  /** Totals from before study time was saved to the account; moved there once on first run. */
  studied?: Record<string, number>;
};

const SESSION_KEY = 'trajectory.study-session';
const COMPANION_KEY = 'trajectory.companion';

function fresh(now: number): SessionState {
  return { day: dayKey(now), activeId: null, mode: 'idle', since: null };
}

/** The saved session if it's from today, otherwise a fresh one. */
function sameDay(s: SessionState, at: number): SessionState {
  return s.day === dayKey(at) ? s : fresh(at);
}

function load(now: number): SessionState {
  const saved = read<SessionState>(SESSION_KEY);
  return saved && saved.day === dayKey(now) ? saved : fresh(now);
}

/** Ticks every second while the timer is running, otherwise every 30 seconds. */
function useTick(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), running ? 1000 : 30_000);
    return () => clearInterval(id);
  }, [running]);
  return now;
}

export function useStudySession() {
  const { study, addStudyTime } = useStore();
  const [saved, setSaved] = useState(() => load(Date.now()));
  const savedRef = useRef(saved);
  const [cheering, setCheering] = useState(false);
  const [companion, setCompanionState] = useState<CompanionKind>(() => read<CompanionKind>(COMPANION_KEY) ?? 'critter');
  const now = useTick(saved.mode !== 'idle' || cheering);
  // Midnight in Brisbane: nothing carries across days, just start over.
  const state = saved.day === dayKey(now) ? saved : fresh(now);

  const commit = useCallback((next: SessionState) => {
    savedRef.current = next;
    write(SESSION_KEY, next);
    setSaved(next);
  }, []);

  /** Save the running study segment to the account. */
  const bank = useCallback(
    (s: SessionState, at: number) => {
      if (s.mode === 'study' && s.activeId && s.since !== null) addStudyTime(s.activeId, at - s.since, at);
    },
    [addStudyTime],
  );

  // Move totals kept on this device by older versions into the account, once.
  useEffect(() => {
    const s = savedRef.current;
    if (!s.studied) return;
    const at = Date.now();
    try {
      for (const [id, ms] of Object.entries(s.studied)) addStudyTime(id, ms, at);
      const { studied: _moved, ...rest } = s;
      commit(rest);
    } catch {
      // Not signed in yet; try again next time.
    }
  }, [addStudyTime, commit]);

  const focus = useCallback(
    (id: string) => {
      const at = Date.now();
      const s = sameDay(savedRef.current, at);
      bank(s, at);
      commit({ ...s, activeId: id, mode: 'study', since: at });
    },
    [bank, commit],
  );
  const takeBreak = useCallback(() => {
    const at = Date.now();
    const s = sameDay(savedRef.current, at);
    if (s.mode !== 'study') return;
    bank(s, at);
    commit({ ...s, mode: 'break', since: at });
  }, [bank, commit]);
  const resume = useCallback(() => {
    const at = Date.now();
    const s = sameDay(savedRef.current, at);
    if (s.mode === 'break' && s.activeId) commit({ ...s, mode: 'study', since: at });
  }, [commit]);
  const stop = useCallback(() => {
    const at = Date.now();
    const s = sameDay(savedRef.current, at);
    bank(s, at);
    commit({ ...s, activeId: null, mode: 'idle', since: null });
  }, [bank, commit]);
  /** Stop because today's goal was reached, and celebrate for a few seconds. */
  const finish = useCallback(() => {
    stop();
    setCheering(true);
    setTimeout(() => setCheering(false), 4000);
  }, [stop]);

  const setCompanion = useCallback((kind: CompanionKind) => {
    setCompanionState(kind);
    write(COMPANION_KEY, kind);
  }, []);

  // Saved study time today, from every device.
  const banked = study?.day === state.day ? study.ms : {};

  /** Study time today for one assessment, including the running segment. */
  const studiedMs = (id: string) =>
    (banked[id] ?? 0) + (state.mode === 'study' && state.activeId === id && state.since !== null ? Math.max(0, now - state.since) : 0);

  const totalStudiedMs = Object.keys({ ...banked, ...(state.activeId ? { [state.activeId]: 0 } : {}) }).reduce(
    (sum, id) => sum + studiedMs(id),
    0,
  );

  return {
    now,
    mode: state.mode,
    activeId: state.activeId,
    /** How long the current break has lasted. */
    breakMs: state.mode === 'break' && state.since !== null ? Math.max(0, now - state.since) : 0,
    studiedMs,
    totalStudiedMs,
    focus,
    takeBreak,
    resume,
    stop,
    finish,
    /** True for a few seconds after a goal is reached. */
    cheering,
    companion,
    setCompanion,
  };
}

/** "1:05:09" or "05:09". */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "1h 20m", "45m", "0m". */
export function minutesLabel(ms: number): string {
  const mins = Math.floor(Math.max(0, ms) / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
