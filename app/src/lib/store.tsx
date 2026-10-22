import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';

import {
  assessmentFromRow,
  courseFromRow,
  topicFromRow,
  type Assessment,
  type AssessmentRow,
  type AssessmentType,
  type Course,
  type CourseRow,
  type Status,
  type TopicRow,
} from '@/data/courses';
import type { ImportedCourse } from '@/lib/api';
import { dayKey } from '@/lib/day';
import { supabase } from '@/lib/supabase';
import { readCache, writeCache, type Profile, type Snapshot, type StudyDay } from '@/lib/sync/cache';
import { useOnline } from '@/lib/sync/network';
import { isTemp, Outbox, tempId, type NewOp } from '@/lib/sync/outbox';
import { subscribeToChanges } from '@/lib/sync/realtime';
import { readJson } from '@/lib/sync/storage';

export type { Profile, StudyDay } from '@/lib/sync/cache';

/** Values the assessment form edits. */
export type AssessmentInput = {
  name: string;
  due: string | null;
  weight: number;
  type: AssessmentType;
  status: Status;
  hours: number | null;
  isHurdle: boolean;
};

type Store = {
  session: Session | null;
  authReady: boolean;
  profile: Profile | null;
  courses: Course[];
  /** Today's study time per assessment, from every device (plus anything not yet saved). */
  study: StudyDay | null;
  loading: boolean;
  error: string | null;
  /** False when the device has no network; edits still work and are saved later. */
  online: boolean;
  /** Edits made on this device that haven't reached the server yet. */
  pendingCount: number;
  reload: () => Promise<void>;
  setSemester: (semester: string) => Promise<void>;
  finishOnboarding: () => Promise<void>;
  saveImportedCourse: (imported: ImportedCourse) => Promise<string>;
  addCourseManually: (code: string, name: string) => Promise<string>;
  updateCourse: (id: string, fields: { code?: string; name?: string }) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;
  addAssessment: (courseId: string, input: AssessmentInput) => Promise<void>;
  updateAssessment: (id: string, input: AssessmentInput) => Promise<void>;
  setStatus: (id: string, status: Status) => Promise<void>;
  deleteAssessment: (id: string) => Promise<void>;
  addTopic: (courseId: string, name: string) => Promise<void>;
  setTopicNotes: (id: string, hasNotes: boolean) => Promise<void>;
  deleteTopic: (id: string) => Promise<void>;
  addStudyTime: (assessmentId: string, ms: number, at: number) => void;
  signOut: () => Promise<void>;
};

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}

/** "2026 S2" → { year: 2026, semester: 2 } */
export function parseSemester(s: string): { year: number; semester: number } {
  const m = /^(\d{4})\s*S([12])$/.exec(s.trim());
  return m ? { year: Number(m[1]), semester: Number(m[2]) } : { year: 2026, semester: 2 };
}

const OFFLINE_MESSAGE = "You're offline. Connect to the internet and try again.";

/** A request that never reached the server. */
class OfflineError extends Error {
  constructor() {
    super(OFFLINE_MESSAGE);
  }
}

/** Unwrap a Supabase result, turning errors into exceptions. */
function check<T>(result: { data: T; error: { message: string } | null; status: number }): NonNullable<T> {
  if (result.error) {
    // 401: the login token expired while offline and hasn't been refreshed yet; same as offline.
    if (result.status === 0 || result.status === 401 || /failed to fetch|network request failed|load failed/i.test(result.error.message)) {
      throw new OfflineError();
    }
    throw new Error(result.error.message);
  }
  return result.data as NonNullable<T>;
}

/** The login Supabase keeps on the device, read directly (used when it can't be refreshed offline). */
function savedSession(): Session | null {
  const key = (supabase.auth as unknown as { storageKey: string }).storageKey;
  const saved = readJson<Session>(key);
  return saved?.user?.id ? saved : null;
}

function rowFromInput(input: AssessmentInput) {
  return {
    name: input.name.trim(),
    due_date: input.due,
    weighting: input.weight,
    type: input.type,
    status: input.status,
    estimated_hours: input.hours,
    is_hurdle: input.isHurdle,
  };
}

/** Id as the database wants it: a number, or a temporary id the outbox swaps for the real one. */
const ref = (id: string) => (isTemp(id) ? id : Number(id));

/** Everything the app shows for one account. `owner` says whose it is, so nothing leaks between accounts. */
type Data = Snapshot & { owner: string | null };
const EMPTY: Snapshot = { profile: null, courses: [], study: null };

/** Fetch the account's current data from Supabase. */
async function fetchSnapshot(userId: string): Promise<Snapshot> {
  // The signup trigger normally creates this row; this is a safety net.
  check(await supabase.from('profiles').upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true }));
  const p = check(await supabase.from('profiles').select('semester, onboarded').eq('id', userId).single());
  const profile: Profile = { semester: p.semester ?? '2026 S2', onboarded: !!p.onboarded };

  const rows = check(
    await supabase
      .from('courses')
      .select('id, code, name, semester, profile_url, assessments(*)')
      .eq('semester', profile.semester)
      .order('code'),
  ) as CourseRow[];
  // Topics and study time are read on their own so the app still opens if those tables haven't been created yet.
  const topicResult = await supabase
    .from('topics')
    // '*' so the app keeps working before and after the note-ingestion migration adds columns.
    .select('*')
    .in('course_id', rows.map((r) => r.id))
    .order('position')
    .order('id');
  const topics = (topicResult.error ? [] : topicResult.data) as TopicRow[];

  const day = dayKey(Date.now());
  const studyResult = await supabase.from('study_time').select('assessment_id, ms').eq('day', day);
  const study: StudyDay = { day, ms: {} };
  for (const r of (studyResult.error ? [] : studyResult.data) as { assessment_id: number; ms: number }[]) {
    study.ms[String(r.assessment_id)] = Number(r.ms);
  }

  return { profile, courses: rows.map((r) => courseFromRow(r, topics)), study };
}

function mapAssessments(courses: Course[], fn: (a: Assessment) => Assessment | null): Course[] {
  return courses.map((c) => ({ ...c, assessments: c.assessments.map(fn).filter((a): a is Assessment => a !== null) }));
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<Data>({ ...EMPTY, owner: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();

  // Follow sign-in / sign-out.
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      // Offline with an expired login token: Supabase can't refresh it, but it's still
      // saved on the device. Stay signed in with it; Supabase refreshes it once we're back online.
      setSession(data.session ?? (isAuthRetryableFetchError(error) ? savedSession() : null));
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // getSession() above handles the first session (including the offline case).
      if (event !== 'INITIAL_SESSION') setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;
  const outbox = useMemo(() => (userId ? new Outbox(userId) : null), [userId]);

  // On sign-in (or switching account), open with what this device saw last time, before the network answers.
  if (data.owner !== userId) {
    setData(userId ? { ...(readCache(userId) ?? EMPTY), owner: userId } : { ...EMPTY, owner: null });
  }

  // Keep the cache in step with every change, including ones not saved to the server yet.
  useEffect(() => {
    if (data.owner) writeCache(data.owner, { profile: data.profile, courses: data.courses, study: data.study });
  }, [data]);

  const subscribePending = useCallback((fn: () => void) => outbox?.subscribe(fn) ?? (() => {}), [outbox]);
  // The third argument is for web static rendering, where nothing is queued yet.
  const pendingCount = useSyncExternalStore(subscribePending, () => outbox?.size ?? 0, () => 0);

  const mine = data;
  const latest = useRef(mine);
  useEffect(() => {
    latest.current = mine;
  }, [mine]);

  /**
   * Send queued edits, then fetch fresh data. Only replaces what's on screen
   * once nothing is waiting, so unsaved edits never flicker back.
   * Overlapping calls are merged into one follow-up run.
   */
  const syncState = useRef<{ running: Promise<void> | null; again: boolean }>({ running: null, again: false });
  const sync = useCallback((): Promise<void> => {
    if (!userId || !outbox) return Promise.resolve();
    const s = syncState.current;
    if (s.running) {
      s.again = true;
      return s.running;
    }
    const run = async () => {
      do {
        s.again = false;
        try {
          const sent = await outbox.flush();
          if (sent.rejected.length) setError(sent.rejected.join('\n'));
          else if (sent.parked) setError('Some changes are waiting for a database update. Run the latest Supabase migrations.');
          if (sent.offline || outbox.size) continue;
          const snap = await fetchSnapshot(userId);
          // Edits made while we were fetching win; the next run picks up the rest.
          if (outbox.size) continue;
          setData({ ...snap, owner: userId });
        } catch (e) {
          if (!(e instanceof OfflineError)) setError(e instanceof Error ? e.message : String(e));
        }
      } while (s.again);
    };
    s.running = run().finally(() => {
      s.running = null;
    });
    return s.running;
  }, [userId, outbox]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await sync();
    } finally {
      setLoading(false);
    }
  }, [sync]);

  // Load on sign-in, and again whenever the network comes back.
  useEffect(() => {
    if (userId && online) sync();
  }, [userId, online, sync]);

  // Catch up when the app comes back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => sub.remove();
  }, [sync]);

  // If saving failed for a reason other than being offline (e.g. server hiccup), keep retrying.
  useEffect(() => {
    if (!online || pendingCount === 0) return;
    const id = setInterval(sync, 15_000);
    return () => clearInterval(id);
  }, [online, pendingCount, sync]);

  // Live updates from the user's other devices.
  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToChanges(userId, {
      onChange: () => {
        clearTimeout(timer);
        timer = setTimeout(sync, 400);
      },
      isKnownId: (table, id) => {
        const courses = latest.current.courses;
        if (table === 'courses') return courses.some((c) => c.id === id);
        if (table === 'assessments') return courses.some((c) => c.assessments.some((a) => a.id === id));
        return courses.some((c) => c.topics.some((t) => t.id === id));
      },
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [userId, sync]);

  const requireUser = useCallback(() => {
    if (!userId || !outbox) throw new Error('Not signed in.');
    return { id: userId, outbox };
  }, [userId, outbox]);

  /** Show an edit straight away, remember it on the device, and save it when we can. */
  const edit = useCallback(
    (op: NewOp, apply: (d: Data) => Data) => {
      const { id, outbox } = requireUser();
      setData((d) => (d.owner === id ? apply(d) : d));
      outbox.add(op);
      sync();
    },
    [requireUser, sync],
  );

  const store = useMemo<Store>(
    () => ({
      session,
      authReady,
      profile: mine.profile,
      courses: mine.courses,
      study: mine.study,
      loading,
      error,
      online,
      pendingCount,
      reload,

      async setSemester(semester) {
        const { id } = requireUser();
        if (semester === mine.profile?.semester) return;
        // Show the courses this device already has for that semester; the rest arrive once it's saved and reloaded.
        edit({ kind: 'update', table: 'profiles', rowId: id, values: { semester } }, (d) => ({
          ...d,
          profile: { onboarded: d.profile?.onboarded ?? false, semester },
          courses: d.courses.filter((c) => c.semester === semester),
        }));
      },

      async finishOnboarding() {
        const { id } = requireUser();
        edit({ kind: 'update', table: 'profiles', rowId: id, values: { onboarded: true } }, (d) => ({
          ...d,
          profile: { semester: d.profile?.semester ?? '2026 S2', onboarded: true },
        }));
      },

      async saveImportedCourse(imported) {
        // Imports replace a batch of rows at once and come from the backend, so they need the network.
        const { id, outbox } = requireUser();
        if (!online) throw new OfflineError();
        await outbox.flush();
        const semester = mine.profile?.semester ?? '2026 S2';
        // Profiles title themselves "STAT2201 Name" or "Name (STAT2201)"; keep just the name.
        const name = (imported.title ?? '')
          .replace(new RegExp(`^${imported.code}\\s*|\\s*\\(${imported.code}\\)$`, 'g'), '')
          .trim();
        const course = check(
          await supabase
            .from('courses')
            .upsert(
              {
                user_id: id,
                code: imported.code,
                name: name || imported.code,
                semester,
                profile_url: imported.profile_url,
                semester_start: imported.semester_start,
              },
              { onConflict: 'user_id,code,semester' },
            )
            .select('id')
            .single(),
        );
        // Re-importing replaces earlier imported items but keeps ones you added yourself.
        check(await supabase.from('assessments').delete().eq('course_id', course.id).eq('source', 'imported'));
        if (imported.assessments.length) {
          check(
            await supabase.from('assessments').insert(
              imported.assessments.map((a) => ({
                user_id: id,
                course_id: course.id,
                name: a.name,
                type: a.type,
                weighting: a.weight,
                due_date: a.due,
                is_hurdle: a.is_hurdle,
                needs_review: a.needs_review,
                note: a.note,
                source: 'imported',
              })),
            ),
          );
        }
        // Add the profile's topics that aren't on the course yet; existing ones keep their notes status.
        const profileTopics = imported.topics ?? [];
        if (profileTopics.length) {
          const existing = check(await supabase.from('topics').select('name').eq('course_id', course.id)) as { name: string }[];
          const have = new Set(existing.map((t) => t.name.toLowerCase()));
          const fresh = profileTopics.filter((t) => !have.has(t.name.toLowerCase()));
          if (fresh.length) {
            check(
              await supabase.from('topics').insert(
                fresh.map((t) => ({
                  user_id: id,
                  course_id: course.id,
                  name: t.name,
                  week: t.week,
                  position: profileTopics.indexOf(t),
                  source: 'imported',
                })),
              ),
            );
          }
        }
        await reload();
        return String(course.id);
      },

      async addCourseManually(code, name) {
        const { id } = requireUser();
        const clean = code.trim().toUpperCase();
        if (mine.courses.some((c) => c.code === clean)) throw new Error(`${clean} is already in your courses.`);
        const semester = mine.profile?.semester ?? '2026 S2';
        const courseId = tempId();
        edit(
          { kind: 'insert', table: 'courses', tempId: courseId, values: { user_id: id, code: clean, name: name.trim(), semester } },
          (d) => ({
            ...d,
            courses: [...d.courses, courseFromRow({ id: courseId as never, code: clean, name: name.trim(), semester, profile_url: null })].sort(
              (a, b) => a.code.localeCompare(b.code),
            ),
          }),
        );
        return courseId;
      },

      async updateCourse(courseId, fields) {
        edit({ kind: 'update', table: 'courses', rowId: courseId, values: fields }, (d) => ({
          ...d,
          courses: d.courses.map((c) => (c.id === courseId ? { ...c, ...fields } : c)),
        }));
      },

      async deleteCourse(courseId) {
        edit({ kind: 'delete', table: 'courses', rowId: courseId }, (d) => ({
          ...d,
          courses: d.courses.filter((c) => c.id !== courseId),
        }));
      },

      async addAssessment(courseId, input) {
        const { id } = requireUser();
        const assessmentId = tempId();
        const row = { ...rowFromInput(input), source: 'manual' };
        const shown = assessmentFromRow({
          ...row,
          id: assessmentId as never,
          course_id: courseId as never,
          needs_review: false,
          note: null,
        });
        edit(
          { kind: 'insert', table: 'assessments', tempId: assessmentId, values: { ...row, user_id: id, course_id: ref(courseId) } },
          (d) => ({
            ...d,
            courses: d.courses.map((c) => (c.id === courseId ? { ...c, assessments: [...c.assessments, shown] } : c)),
          }),
        );
      },

      async updateAssessment(assessmentId, input) {
        const values = { ...rowFromInput(input), needs_review: false };
        edit({ kind: 'update', table: 'assessments', rowId: assessmentId, values }, (d) => ({
          ...d,
          courses: mapAssessments(d.courses, (a) =>
            a.id === assessmentId
              ? assessmentFromRow({
                  ...values,
                  id: a.id as never,
                  course_id: a.courseId as never,
                  source: null,
                  note: a.note,
                } satisfies AssessmentRow)
              : a,
          ),
        }));
      },

      async setStatus(assessmentId, status) {
        edit({ kind: 'update', table: 'assessments', rowId: assessmentId, values: { status } }, (d) => ({
          ...d,
          courses: mapAssessments(d.courses, (a) => (a.id === assessmentId ? { ...a, status } : a)),
        }));
      },

      async deleteAssessment(assessmentId) {
        edit({ kind: 'delete', table: 'assessments', rowId: assessmentId }, (d) => ({
          ...d,
          courses: mapAssessments(d.courses, (a) => (a.id === assessmentId ? null : a)),
        }));
      },

      async addTopic(courseId, name) {
        const { id } = requireUser();
        const topicId = tempId();
        const course = mine.courses.find((c) => c.id === courseId);
        const row = { name: name.trim(), position: course?.topics.length ?? 0, source: 'manual' };
        const shown = topicFromRow({ ...row, id: topicId as never, course_id: courseId as never, week: null, has_notes: false });
        edit(
          { kind: 'insert', table: 'topics', tempId: topicId, values: { ...row, user_id: id, course_id: ref(courseId) } },
          (d) => ({
            ...d,
            courses: d.courses.map((c) => (c.id === courseId ? { ...c, topics: [...c.topics, shown] } : c)),
          }),
        );
      },

      async setTopicNotes(topicId, hasNotes) {
        edit({ kind: 'update', table: 'topics', rowId: topicId, values: { has_notes: hasNotes } }, (d) => ({
          ...d,
          courses: d.courses.map((c) => ({ ...c, topics: c.topics.map((t) => (t.id === topicId ? { ...t, hasNotes } : t)) })),
        }));
      },

      async deleteTopic(topicId) {
        edit({ kind: 'delete', table: 'topics', rowId: topicId }, (d) => ({
          ...d,
          courses: d.courses.map((c) => ({ ...c, topics: c.topics.filter((t) => t.id !== topicId) })),
        }));
      },

      addStudyTime(assessmentId, ms, at) {
        const day = dayKey(at);
        const add = Math.round(ms);
        if (add <= 0) return;
        edit(
          { kind: 'rpc', fn: 'add_study_time', args: { p_day: day, p_assessment: ref(assessmentId), p_ms: add } },
          (d) => {
            const today = d.study?.day === day ? d.study.ms : {};
            return { ...d, study: { day, ms: { ...today, [assessmentId]: (today[assessmentId] ?? 0) + add } } };
          },
        );
      },

      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session, authReady, mine, loading, error, online, pendingCount, reload, requireUser, edit],
  );

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
