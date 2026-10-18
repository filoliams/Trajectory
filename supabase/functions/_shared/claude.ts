import Anthropic from 'npm:@anthropic-ai/sdk@0.135.0';

import { SYSTEM_PROMPT, resultSchema } from './analysis.ts';
import { Friendly } from './http.ts';

export const MODEL = 'claude-opus-5-5';

type Block = Anthropic.Beta.Messages.BetaContentBlockParam;

/**
 * The one Claude call: which course a file belongs to and how well it covers each topic.
 * Streams so a long handwritten PDF can't hit an HTTP timeout; falls back server-side on a policy decline.
 */
export async function askClaude(content: Block[], codes: string[]) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Friendly('Note analysis isn’t set up on the server yet.');
  const client = new Anthropic({ apiKey });

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM_PROMPT,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: resultSchema(codes) } },
    messages: [{ role: 'user', content }],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') throw new Friendly('This file couldn’t be analysed.');
  if (message.stop_reason === 'max_tokens') throw new Friendly('This file has too many topics to analyse at once.');
  const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Friendly('The analysis came back in an unexpected shape. Try syncing again.');
  }
  const usage = message.usage;
  return {
    raw,
    inputTokens: usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
    outputTokens: usage.output_tokens,
  };
}
