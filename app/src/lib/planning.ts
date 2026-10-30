import { useEffect, useState } from 'react';

import type { Assessment, Course, Level } from '@/data/courses';
import { band, courseConfidence, type Band } from '@/lib/confidence';
import { courseLevel } from '@/lib/levels';
import { T } from '@/constants/trajectory';

const DAY_MS = 86_400_000;

/** Current time, refreshed every 30 seconds so countdowns tick. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function daysUntil(iso: string | null, now: number): number {
  if (!iso) return Infinity;
  return (new Date(iso).getTime() - now) / DAY_MS;
}

/** "1d 12h 48m" style countdown. */
export function countdown(iso: string | null, now: number): string {
  if (!iso) return 'No date';
  let ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'Due';
  const d = Math.floor(ms / DAY_MS);
  ms -= d * DAY_MS;
  const h = Math.floor(ms / 3_600_000);
  ms -= h * 3_600_000;
  const m = Math.floor(ms / 60_000);
  return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
}

/** "Fri 16 Oct, 4:00 pm" in Brisbane time. */
export function dueLabel(iso: string | null): string {
  if (!iso) return 'No date set';
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Australia/Brisbane' });
  const time = date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Brisbane' });
  return `${day}, ${time}`;
}

/**
 * Priority = weighting ÷ days left, plus a big boost for anything due
 * within 2 days. Higher is more urgent.
 */
export function priorityScore(a: Assessment, now: number): number {
  const days = daysUntil(a.due, now);
  return a.weight / Math.max(days, 0.5) + (days < 2 ? 5 : 0);
}

export function byPriority(items: Assessment[], now: number): Assessment[] {
  return items
    .filter((a) => a.status !== 'done' && a.due !== null && daysUntil(a.due, now) > 0)
    .sort((x, y) => priorityScore(y, now) - priorityScore(x, now));
}

/** Percent of the course's weighting not yet completed. */
export function percentToGo(course: Course): number {
  const left = course.assessments.filter((a) => a.status !== 'done').reduce((sum, a) => sum + a.weight, 0);
  return Math.min(100, Math.round(left * 10) / 10);
}

/** Share (0–1) of the entered weighting that's done, so a half-entered course isn't shown as nearly finished. */
export function shareDone(course: Course): number {
  const total = course.assessments.reduce((sum, a) => sum + a.weight, 0);
  const done = course.assessments.filter((a) => a.status === 'done').reduce((sum, a) => sum + a.weight, 0);
  return total > 0 ? done / total : 0;
}

/** How well the student's notes cover the course's topics: analysed levels once there are enough, else coverage. */
export function notesLevel(course: Course): Level {
  return courseLevel(course.topics);
}

/** Most hours a day one item gets, by how confident the student is in the course: shakier courses get more time. */
const DAILY_CAP: Record<Band | 'no-topics', number> = { shaky: 2, 'getting-there': 1.5, confident: 1, 'no-topics': 1.5 };

export function urgencyColor(days: number): string {
  if (days < 2) return T.urgent;
  if (days < 5) return T.warn;
  return T.ink;
}

export function urgencyBarColor(days: number): string {
  if (days < 2) return T.urgent;
  if (days < 5) return T.warnBar;
  return T.accent;
}

export function hoursLabel(h: number): string {
  if (h < 1) return `~${Math.round(h * 60)}m`;
  return `~${h >= 10 || h % 1 === 0 ? Math.round(h) : h.toFixed(1)}h`;
}

/** Automatic one-line reason, used when an assessment has no custom one. */
export function whyLabel(a: Assessment, now: number): string {
  const days = daysUntil(a.due, now);
  const when = days < 1 ? 'today' : days < 2 ? 'tomorrow' : `in ${Math.ceil(days)} days`;
  return `${a.weight}% of the course, due ${when}.`;
}

export type PlanItem = { course: Course; assessment: Assessment };

/** Hours of an assessment scheduled for today (1–2h per item, more for courses the student is less confident in). */
export function todayHours(a: Assessment, course: Course): number {
  const confidence = courseConfidence(course.topics);
  return Math.min(a.hoursLeft, DAILY_CAP[confidence === null ? 'no-topics' : band(confidence)]);
}

/** Today's plan: highest-priority items across all courses that fit in the hours available. */
export function todaysPlan(all: Course[], now: number, hoursAvailable = 4): PlanItem[] {
  const ranked = all
    .flatMap((course) => byPriority(course.assessments, now).map((assessment) => ({ course, assessment })))
    .sort((x, y) => priorityScore(y.assessment, now) - priorityScore(x.assessment, now));
  const plan: PlanItem[] = [];
  let used = 0;
  for (const item of ranked) {
    const slot = todayHours(item.assessment, item.course);
    if (used + slot > hoursAvailable) continue;
    plan.push(item);
    used += slot;
    if (plan.length === 4) break;
  }
  return plan;
}

/** Every upcoming, unfinished deadline across all courses, soonest first. */
export function upcoming(all: Course[], now: number): PlanItem[] {
  return all
    .flatMap((course) => byPriority(course.assessments, now).map((assessment) => ({ course, assessment })))
    .sort((x, y) => daysUntil(x.assessment.due, now) - daysUntil(y.assessment.due, now));
}

/** "4d 01h" — the countdown without minutes, for compact rows. */
export function shortCountdown(iso: string | null, now: number): string {
  return countdown(iso, now).split(' ').slice(0, 2).join(' ');
}

/** Unfinished items with no due date yet (they can't be ranked). */
export function undated(items: Assessment[]): Assessment[] {
  return items.filter((a) => a.status !== 'done' && a.due === null);
}

/** Finished items, or ones whose date has passed. */
export function finishedOrPast(items: Assessment[], now: number): Assessment[] {
  return items.filter((a) => a.status === 'done' || (a.due !== null && daysUntil(a.due, now) <= 0));
}
