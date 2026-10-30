/** How confident a student can be in a topic, from their notes level and "Quiz me" scores. Pure, so Node can test it. */

import type { Understanding } from './levels.ts';

type Quiz = { score: number; total: number; at: string };
export type ConfidenceTopic = { hasNotes: boolean; understanding: Understanding | null; quizzes?: Quiz[] };
export type Band = 'confident' | 'getting-there' | 'shaky';
export type Trend = 'up' | 'down' | 'same';

const NOTES: Record<Understanding, number> = { none: 0, weak: 33, okay: 67, strong: 100 };

/**
 * 0–100. With no quiz the notes alone count, capped at 60%. After one quiz, notes 40% and the quiz 60%;
 * after two or more, notes 20% and the last two quizzes 80% (owner's decision, 2026-10-30), so good
 * quiz results can carry a topic with thin notes to Confident.
 * `upTo` (ms) ignores quizzes taken after it, for "this week" comparisons.
 */
export function topicConfidence(t: ConfidenceTopic, upTo = Infinity): number {
  const notes = t.understanding ? NOTES[t.understanding] : t.hasNotes ? 50 : 0;
  const quizzes = (t.quizzes ?? []).filter((q) => Date.parse(q.at) <= upTo && q.total > 0);
  if (!quizzes.length) return Math.round(notes * 0.6);
  const recent = quizzes.slice(-2);
  const quiz = (recent.reduce((s, q) => s + q.score / q.total, 0) / recent.length) * 100;
  const w = quizzes.length >= 2 ? 0.8 : 0.6;
  return Math.round((1 - w) * notes + w * quiz);
}

export function band(value: number): Band {
  return value >= 75 ? 'confident' : value >= 40 ? 'getting-there' : 'shaky';
}

/** Which way the latest quiz moved confidence; null before the first quiz. */
export function trend(t: ConfidenceTopic): Trend | null {
  const quizzes = t.quizzes ?? [];
  if (!quizzes.length) return null;
  const d = topicConfidence(t) - topicConfidence({ ...t, quizzes: quizzes.slice(0, -1) });
  return d > 0 ? 'up' : d < 0 ? 'down' : 'same';
}

/** Monday 00:00 local time of the week containing `now`. */
export function weekStart(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** Change in confidence since the start of this week, from quizzes taken this week. */
export function weekChange(t: ConfidenceTopic, now: number): number {
  return topicConfidence(t) - topicConfidence(t, weekStart(now) - 1);
}

/** A course's confidence: the average of its topics, or null with no topics. */
export function courseConfidence(topics: ConfidenceTopic[], upTo = Infinity): number | null {
  if (!topics.length) return null;
  return Math.round(topics.reduce((s, t) => s + topicConfidence(t, upTo), 0) / topics.length);
}
