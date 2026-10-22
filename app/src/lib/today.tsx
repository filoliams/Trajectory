import { createContext, useContext, useEffect, type ReactNode } from 'react';

import type { Assessment, Course, Status } from '@/data/courses';
import { useSmartPlan, type SmartItem, type SmartPlan } from '@/lib/ai-plan';
import { useDailyHours } from '@/lib/daily-hours';
import { dayKey } from '@/lib/day';
import { useHolidays } from '@/lib/holidays';
import { todayHours, todaysPlan, type PlanItem } from '@/lib/planning';
import { useStore } from '@/lib/store';
import { useStudySession } from '@/lib/study-session';

const HOUR_MS = 3_600_000;

export type TodayItem = { course: Course; assessment: Assessment; studied: number; target: number; finished: boolean };

type Today = {
  study: ReturnType<typeof useStudySession>;
  now: number;
  holidays: Map<string, string>;
  holidayToday: string | undefined;
  smart: SmartPlan;
  /** Sonnet's blocks by assessment id, when there's a smart plan. */
  smartFor: Map<string, SmartItem>;
  plan: (PlanItem | SmartItem)[];
  hoursToday: (a: Assessment, course: Course) => number;
  plannedMs: number;
  /** Every assessment with today's study time and target. */
  all: TodayItem[];
  /** Today's plan, minus what's finished. */
  todo: TodayItem[];
  completed: TodayItem[];
  /** What the timer is on, if anything. */
  active: TodayItem | undefined;
  next: TodayItem | undefined;
  startOn: (id: string, status: Status) => void;
};

const TodayContext = createContext<Today | null>(null);

/**
 * Today's plan and the study timer, shared by the Today and Study tabs so both see one clock.
 * Lives above the tabs so it keeps running whichever tab is open.
 */
export function TodayProvider({ children }: { children: ReactNode }) {
  const study = useStudySession();
  const { now } = study;
  const { courses, setStatus, online } = useStore();
  const [hoursAvailable] = useDailyHours();
  const holidays = useHolidays(now);
  const holidayToday = holidays.get(dayKey(now));
  // Sonnet's plan when there is one; the on-device plan otherwise.
  const smart = useSmartPlan(courses, hoursAvailable, holidayToday ?? null, online, dayKey(now));
  const smartItems = smart.items?.length ? smart.items : null;
  const smartFor = new Map(smartItems?.map((s) => [s.assessment.id, s]));
  const plan = smartItems ?? todaysPlan(courses, now, hoursAvailable);
  const hoursToday = (a: Assessment, course: Course) => {
    const block = smartFor.get(a.id);
    return block ? block.minutes / 60 : todayHours(a, course);
  };
  const plannedMs = plan.reduce((sum, p) => sum + hoursToday(p.assessment, p.course), 0) * HOUR_MS;

  // An item is finished for today once its timer reaches today's slot.
  const all = courses.flatMap((course) =>
    course.assessments.map((assessment) => {
      const studied = study.studiedMs(assessment.id);
      const target = hoursToday(assessment, course) * HOUR_MS;
      return { course, assessment, studied, target, finished: studied > 0 && studied >= target };
    }),
  );
  const todo = plan.flatMap((p) => all.filter((x) => x.assessment.id === p.assessment.id && !x.finished));
  const completed = all.filter((x) => x.finished);
  // Look the active item up across all courses: it may have dropped off today's plan.
  const active = all.find((x) => x.assessment.id === study.activeId && x.assessment.status !== 'done');

  // Hitting the goal stops the clock and moves the item to "Completed today".
  const activeFinished = !!active?.finished && study.mode === 'study';
  const { finish } = study;
  useEffect(() => {
    if (activeFinished) finish();
  }, [activeFinished, finish]);

  const startOn = (id: string, status: Status) => {
    study.focus(id);
    if (status === 'not_started') setStatus(id, 'in_progress');
  };

  const value: Today = {
    study,
    now,
    holidays,
    holidayToday,
    smart,
    smartFor,
    plan,
    hoursToday,
    plannedMs,
    all,
    todo,
    completed,
    active,
    next: todo[0],
    startOn,
  };
  return <TodayContext.Provider value={value}>{children}</TodayContext.Provider>;
}

export function useToday(): Today {
  const value = useContext(TodayContext);
  if (!value) throw new Error('useToday must be used inside TodayProvider');
  return value;
}
