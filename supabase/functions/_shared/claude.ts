import Anthropic from 'npm:@anthropic-ai/sdk@0.135.0';

import { SYSTEM_PROMPT, resultSchema } from './analysis.ts';
import { Friendly } from './http.ts';
import { PLAN_SYSTEM_PROMPT, buildPlanText, planSchema, type PlanContext } from './plan.ts';
import { QUIZ_SYSTEM_PROMPT, buildQuizText, quizSchema, type QuizTopic } from './quiz.ts';

export const MODEL = 'claude-haiku-5-5';
export const PLAN_MODEL = 'claude-sonnet-5-5';

type Block = Anthropic.Beta.Messages.BetaContentBlockParam;
type Messages = { refusal: string; tooLong: string; badShape: string };

/**
 * Note analysis: which course a file belongs to and how well it covers each topic.
 * Haiku has no server-side refusal fallback, so a decline surfaces as a failed document.
 */
export function askClaude(content: Block[], codes: string[]) {
  return structured({ model: MODEL, effort: 'low', fallback: false, system: SYSTEM_PROMPT, content, schema: resultSchema(codes) }, {
    refusal: 'This file couldn’t be analysed.',
    tooLong: 'This file has too many topics to analyse at once.',
    badShape: 'The analysis came back in an unexpected shape. Try syncing again.',
  });
}

/** A three-question quiz on one topic, from Haiku at low effort (owner's choice, 2026-10-30). */
export function askQuizzer(topic: QuizTopic) {
  const content: Block[] = [{ type: 'text', text: buildQuizText(topic) }];
  return structured({ model: MODEL, effort: 'low', fallback: false, system: QUIZ_SYSTEM_PROMPT, content, schema: quizSchema() }, {
    refusal: 'Couldn’t write a quiz on this topic.',
    tooLong: 'Couldn’t write a quiz on this topic.',
    badShape: 'The quiz came back in an unexpected shape. Try again.',
  });
}

/** The daily study plan. Sonnet takes the server-side fallback, so a policy decline is retried on another model. */
export function askPlanner(ctx: PlanContext) {
  const content: Block[] = [{ type: 'text', text: buildPlanText(ctx) }];
  const schema = planSchema(ctx.assessments.map((a) => a.id));
  return structured({ model: PLAN_MODEL, effort: 'medium', fallback: true, system: PLAN_SYSTEM_PROMPT, content, schema }, {
    refusal: 'Couldn’t make a smart plan today.',
    tooLong: 'Couldn’t make a smart plan today.',
    badShape: 'Couldn’t make a smart plan today.',
  });
}

/** One structured-output call. Streams so a long PDF or a slow plan can't hit an HTTP timeout. */
async function structured(
  req: { model: string; effort: 'low' | 'medium'; fallback: boolean; system: string; content: Block[]; schema: unknown },
  messages: Messages,
) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Friendly('AI features aren’t set up on the server yet.');
  const client = new Anthropic({ apiKey });

  const stream = client.beta.messages.stream({
    model: req.model,
    max_tokens: 16000,
    ...(req.fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    system: req.system,
    output_config: { effort: req.effort, format: { type: 'json_schema', schema: req.schema as Record<string, unknown> } },
    messages: [{ role: 'user', content: req.content }],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') throw new Friendly(messages.refusal);
  if (message.stop_reason === 'max_tokens') throw new Friendly(messages.tooLong);
  const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Friendly(messages.badShape);
  }
  const usage = message.usage;
  return {
    raw,
    model: message.model,
    inputTokens: usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
    outputTokens: usage.output_tokens,
  };
}
