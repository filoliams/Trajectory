import type { QuizResult } from '@/data/courses';
import { callFunction } from '@/lib/functions';
import { isTemp } from '@/lib/sync/outbox';

export type Question = { question: string; answers: string[]; correct: number; explanation: string };
export type Quiz = { attemptId: number; questions: Question[] };

/** Three questions on one topic from the quiz-make function; the attempt counts towards today's limit. */
export async function startQuiz(topicId: string): Promise<Quiz> {
  if (isTemp(topicId)) throw new Error('This topic is still being saved. Try again in a moment.');
  const reply = await callFunction<{ attempt_id: number; questions: Question[] }>(
    'quiz-make',
    { topic_id: Number(topicId) },
    'Couldn’t start a quiz right now. Try again in a moment.',
  );
  return { attemptId: reply.attempt_id, questions: reply.questions };
}

/** "Last quiz 2/3, today" / "…, yesterday" / "…, 3 days ago", or null with no finished quiz. */
export function lastQuizLabel(quizzes: QuizResult[] | undefined, now: number): string | null {
  const last = quizzes?.[quizzes.length - 1];
  if (!last) return null;
  const days = Math.floor((startOfDay(now) - startOfDay(Date.parse(last.at))) / 86_400_000);
  const when = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  return `Last quiz ${last.score}/${last.total}, ${when}`;
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
