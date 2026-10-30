// POST { topic_id } → { attempt_id, questions }
// Writes a three-question quiz on one of the student's topics and records the attempt, which counts
// towards the day's quiz limit. The app saves the score on that row when the student finishes.

import { askQuizzer } from '../_shared/claude.ts';
import { Friendly, asCaller, json, preflight } from '../_shared/http.ts';
import { brisbaneDay } from '../_shared/plan.ts';
import { QUIZ_LENGTH, QUIZ_LIMITS, brisbaneDayStart, validateQuiz, type Tier } from '../_shared/quiz.ts';

const NO_QUIZ = 'Couldn’t write a quiz right now. Try again in a moment.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const caller = await asCaller(req);
  if (!caller) return json({ error: 'Sign in again to take a quiz.' }, 401);
  const { db, user } = caller;

  const body = (await req.json().catch(() => null)) as { topic_id?: unknown } | null;
  if (typeof body?.topic_id !== 'number') return json({ error: 'Missing topic_id.' }, 422);

  const { data: topic } = await db.from('topics').select('id, name, week, course_id').eq('id', body.topic_id).maybeSingle();
  if (!topic) return json({ error: 'That topic isn’t yours or no longer exists.' }, 404);
  const { data: course } = await db.from('courses').select('code, name').eq('id', topic.course_id).maybeSingle();
  if (!course) return json({ error: 'That topic isn’t yours or no longer exists.' }, 404);

  // shortcut: every student is on the free tier until paid plans exist; read the tier from their profile then.
  const tier: Tier = 'free';
  const limit = QUIZ_LIMITS[tier];
  const { count } = await db
    .from('quiz_attempts')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', brisbaneDayStart(brisbaneDay(Date.now())));
  if ((count ?? 0) >= limit) {
    return json({ error: `You’ve taken today’s ${limit} quizzes. More are available from midnight.` }, 429);
  }

  let reply;
  try {
    reply = await askQuizzer({ courseCode: course.code, courseName: course.name ?? '', topic: topic.name, week: topic.week });
  } catch (e) {
    console.error(JSON.stringify({ event: 'quiz_failed', topic_id: topic.id, error: e instanceof Error ? e.message.slice(0, 500) : String(e) }));
    return json({ error: e instanceof Friendly ? e.message : NO_QUIZ }, 502);
  }
  const questions = validateQuiz(reply.raw);
  // Token counts only: question and answer text never goes to the logs.
  console.log(JSON.stringify({ event: 'quiz_written', topic_id: topic.id, ok: !!questions, input_tokens: reply.inputTokens, output_tokens: reply.outputTokens }));
  if (!questions) return json({ error: NO_QUIZ }, 502);

  const { data: attempt, error } = await db
    .from('quiz_attempts')
    .insert({ user_id: user.id, topic_id: topic.id, total: QUIZ_LENGTH })
    .select('id')
    .single();
  if (error || !attempt) {
    console.error(JSON.stringify({ event: 'quiz_save_failed', error: error?.message }));
    return json({ error: NO_QUIZ }, 500);
  }
  return json({ attempt_id: attempt.id, questions });
});
