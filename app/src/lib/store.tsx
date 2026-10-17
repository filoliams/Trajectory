import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  courseFromRow,
  type AssessmentType,
  type Course,
  type CourseRow,
  type Status,
} from '@/data/courses';
import type { ImportedCourse } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export type Profile = { semester: string; onboarded: boolean };

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
  loading: boolean;
  error: string | null;
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

/** Unwrap a Supabase result, turning errors into exceptions. */
function check<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<T>;
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Follow sign-in / sign-out.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      // The signup trigger normally creates this row; this is a safety net.
      await supabase.from('profiles').upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });
      const p = check(await supabase.from('profiles').select('semester, onboarded').eq('id', userId).single());
      const prof: Profile = { semester: p.semester ?? '2026 S2', onboarded: !!p.onboarded };
      setProfile(prof);

      const rows = check(
        await supabase
          .from('courses')
          .select('id, code, name, semester, profile_url, assessments(*)')
          .eq('semester', prof.semester)
          .order('code'),
      ) as CourseRow[];
      setCourses(rows.map(courseFromRow));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) reload();
    else {
      setProfile(null);
      setCourses([]);
    }
  }, [userId, reload]);

  const requireUser = useCallback(() => {
    if (!userId) throw new Error('Not signed in.');
    return userId;
  }, [userId]);

  const store = useMemo<Store>(
    () => ({
      session,
      authReady,
      profile,
      courses,
      loading,
      error,
      reload,

      async setSemester(semester) {
        const id = requireUser();
        check(await supabase.from('profiles').update({ semester }).eq('id', id));
        await reload();
      },

      async finishOnboarding() {
        const id = requireUser();
        check(await supabase.from('profiles').update({ onboarded: true }).eq('id', id));
        await reload();
      },

      async saveImportedCourse(imported) {
        const id = requireUser();
        const semester = profile?.semester ?? '2026 S2';
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
        await reload();
        return String(course.id);
      },

      async addCourseManually(code, name) {
        const id = requireUser();
        const course = check(
          await supabase
            .from('courses')
            .insert({ user_id: id, code: code.trim().toUpperCase(), name: name.trim(), semester: profile?.semester ?? '2026 S2' })
            .select('id')
            .single(),
        );
        await reload();
        return String(course.id);
      },

      async updateCourse(courseId, fields) {
        check(await supabase.from('courses').update(fields).eq('id', courseId));
        await reload();
      },

      async deleteCourse(courseId) {
        check(await supabase.from('courses').delete().eq('id', courseId));
        await reload();
      },

      async addAssessment(courseId, input) {
        const id = requireUser();
        check(
          await supabase
            .from('assessments')
            .insert({ ...rowFromInput(input), user_id: id, course_id: Number(courseId), source: 'manual' }),
        );
        await reload();
      },

      async updateAssessment(assessmentId, input) {
        check(
          await supabase
            .from('assessments')
            .update({ ...rowFromInput(input), needs_review: false })
            .eq('id', assessmentId),
        );
        await reload();
      },

      async setStatus(assessmentId, status) {
        // Update the screen straight away, then save.
        setCourses((prev) =>
          prev.map((c) => ({
            ...c,
            assessments: c.assessments.map((a) => (a.id === assessmentId ? { ...a, status } : a)),
          })),
        );
        const result = await supabase.from('assessments').update({ status }).eq('id', assessmentId);
        if (result.error) {
          setError(result.error.message);
          await reload();
        }
      },

      async deleteAssessment(assessmentId) {
        check(await supabase.from('assessments').delete().eq('id', assessmentId));
        await reload();
      },

      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session, authReady, profile, courses, loading, error, reload, requireUser],
  );

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
