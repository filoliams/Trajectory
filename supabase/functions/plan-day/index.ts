// POST { hours, holiday?, replan? } → { blocks, generated_at, replans_left }
// Today's study plan from Sonnet, saved per Brisbane day: reused until the student re-plans or changes
// their study hours, with at most MAX_GENERATIONS calls a day.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';

import { askPlanner } from '../_shared/claude.ts';
import { topicConfidence } from '../_shared/confidence.ts';
import { Friendly, asCaller, json, preflight } from '../_shared/http.ts';
import { brisbaneDay, validatePlan, type PlanBlock, type PlanContext } from '../_shared/plan.ts';

const MAX_GENERATIONS = 3; // the day's plan plus two re-plans
const NO_PLAN = 'Couldn’t make a smart plan today.';

type Saved = { blocks: PlanBlock[]; hours: number; generations: number; updated_at: string };

const reply = (saved: Saved) => ({
  blocks: saved.blocks,
  generated_at: saved.updated_at,
  replans_left: Math.max(0, MAX_GENERATIONS - saved.generations),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const caller = await asCaller(req);
  if (!caller) return json({ error: 'Sign in again to get today’s plan.' }, 401);
  const { db, user } = caller;

  const body = (await req.json().catch(() => null)) as { hours?: unknown; holiday?: unknown; replan?: unknown } | null;
  const hours = body?.hours;
  if (typeof hours !== 'number' || !Number.isInteger(hours) || hours < 1 || hours > 12) {
    return json({ error: 'Choose between 1 and 12 study hours a day.' }, 422);
  }
  const holiday = typeof body?.holiday === 'string' && body.holiday ? body.holiday.slice(0, 100) : null;
  const replan = body?.replan === true;
  // The server decides the day, so a client can't get extra plans by sending other dates.
  const day = brisbaneDay(Date.now());

  const { data: saved } = await db
    .from('daily_plans')
    .select('blocks, hours, generations, updated_at')
    .eq('day', day)
    .maybeSingle<Saved>();
  if (saved && !replan && saved.hours === hours) return json(reply(saved));
  if (saved && saved.generations >= MAX_GENERATIONS) {
    // Out of plans for today: keep the one they have.
    return replan
      ? json({ error: 'You’ve re-planned as often as you can today. Your current plan stays.', ...reply(saved) }, 429)
      : json(reply(saved));
  }

  const ctx = await planContext(db, day, hours, holiday);
  if (!ctx.assessments.length) return json({ blocks: [], generated_at: null, replans_left: MAX_GENERATIONS });

  let result;
  try {
    result = await askPlanner(ctx);
  } catch (e) {
    console.error(JSON.stringify({ event: 'plan_failed', error: e instanceof Error ? e.message.slice(0, 500) : String(e) }));
    return json({ error: e instanceof Friendly ? e.message : NO_PLAN }, 502);
  }
  const blocks = validatePlan(result.raw, ctx);
  console.log(JSON.stringify({ event: 'planned', model: result.model, blocks: blocks.length, input_tokens: result.inputTokens, output_tokens: result.outputTokens }));
  if (!blocks.length) return json({ error: NO_PLAN }, 502);

  const row = {
    user_id: user.id,
    day,
    hours,
    blocks,
    model: result.model,
    generations: (saved?.generations ?? 0) + 1,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from('daily_plans').upsert(row, { onConflict: 'user_id,day' });
  if (error) console.error(JSON.stringify({ event: 'plan_save_failed', error: error.message }));
  return json(reply(row));
});

/** Everything the planner needs, read as the student so row-level security limits it to their own rows. */
async function planContext(db: SupabaseClient, day: string, hours: number, holiday: string | null): Promise<PlanContext> {
  const { data: profile } = await db.from('profiles').select('semester').maybeSingle();
  let courseQuery = db.from('courses').select('id, code, name');
  if (profile?.semester) courseQuery = courseQuery.eq('semester', profile.semester);
  const { data: courses } = await courseQuery;
  if (!courses?.length) return { today: day, hours, holiday, courses: [], assessments: [] };
  const courseIds = courses.map((c) => c.id);

  const [{ data: assessments }, { data: topics }, { data: studied }] = await Promise.all([
    db
      .from('assessments')
      .select('id, course_id, name, type, weighting, due_date, is_hurdle, estimated_hours, status')
      .in('course_id', courseIds)
      .neq('status', 'done')
      .gt('due_date', new Date().toISOString()),
    db.from('topics').select('id, course_id, name, has_notes, understanding, understanding_reason').in('course_id', courseIds).order('position'),
    db.from('study_time').select('assessment_id, ms').eq('day', day),
  ]);
  // Finished quizzes, oldest first. A missing table (migration not run yet) means no quizzes: notes alone.
  const { data: quizRows } = await db.from('quiz_attempts').select('topic_id, score, total').not('score', 'is', null).order('finished_at');
  const quizzesOf = (topicId: number) => (quizRows ?? []).filter((q) => q.topic_id === topicId).map((q) => ({ score: q.score, total: q.total }));

  const codeOf = new Map(courses.map((c) => [c.id, c.code]));
  const msToday = new Map((studied ?? []).map((s) => [s.assessment_id, Number(s.ms)]));
  return {
    today: day,
    hours,
    holiday,
    courses: courses.map((c) => ({
      code: c.code,
      name: c.name ?? '',
      topics: (topics ?? [])
        .filter((t) => t.course_id === c.id)
        .map((t) => ({
          name: t.name,
          confidence: topicConfidence({ understanding: t.understanding ?? null, hasNotes: !!t.has_notes, quizzes: quizzesOf(t.id) }),
          reason: t.understanding_reason ?? null,
        })),
    })),
    assessments: (assessments ?? []).map((a) => ({
      id: a.id,
      courseCode: codeOf.get(a.course_id) ?? '',
      name: a.name,
      type: a.type,
      weight: Number(a.weighting ?? 0),
      due: a.due_date,
      isHurdle: !!a.is_hurdle,
      hoursLeft: a.estimated_hours != null ? Number(a.estimated_hours) : null,
      status: a.status ?? 'not_started',
      studiedMinutesToday: Math.round((msToday.get(a.id) ?? 0) / 60_000),
    })),
  };
}
