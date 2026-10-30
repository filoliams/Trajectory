/** A topic's confidence for the daily plan. Pure, so Node can test it. Same formula as app/src/lib/confidence.ts (check.ts compares them). */

export type ConfidenceInput = { understanding: string | null; hasNotes: boolean; quizzes: { score: number; total: number }[] };
export type Band = 'confident' | 'getting there' | 'shaky';

const NOTES: Record<string, number> = { none: 0, weak: 33, okay: 67, strong: 100 };

/** 0–100: notes alone up to 60%; notes 40% + quiz 60% after one quiz; notes 20% + last two quizzes 80% after two. Quizzes oldest first. */
export function topicConfidence(t: ConfidenceInput): number {
  const notes = t.understanding && t.understanding in NOTES ? NOTES[t.understanding] : t.hasNotes ? 50 : 0;
  const quizzes = t.quizzes.filter((q) => q.total > 0);
  if (!quizzes.length) return Math.round(notes * 0.6);
  const recent = quizzes.slice(-2);
  const quiz = (recent.reduce((s, q) => s + q.score / q.total, 0) / recent.length) * 100;
  const w = quizzes.length >= 2 ? 0.8 : 0.6;
  return Math.round((1 - w) * notes + w * quiz);
}

export function band(value: number): Band {
  return value >= 75 ? 'confident' : value >= 40 ? 'getting there' : 'shaky';
}
