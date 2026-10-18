/** Which course topics a set of notes covers. No imports, so the self-check runs in plain Node. */

const STOP = new Set(['and', 'the', 'for', 'with', 'from', 'into', 'their', 'using', 'week', 'part', 'intro', 'introduction', 'to', 'of', 'in', 'on', 'a', 'an']);

function normalise(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

function keywords(topic: string): string[] {
  return normalise(topic)
    .trim()
    .split(' ')
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/**
 * A topic is covered when its name appears in the notes, or when most of its
 * keywords do (so "Hypothesis testing" matches notes on "testing a hypothesis").
 * shortcut: plain word matching, no stemming or meaning; swap for an LLM pass when notes analysis gets an API.
 */
export function coveredTopics<T extends { name: string }>(topics: T[], notes: string[]): T[] {
  const text = normalise(notes.join('\n'));
  const words = new Set(text.trim().split(' '));
  return topics.filter((t) => {
    if (text.includes(normalise(t.name))) return true;
    const keys = keywords(t.name);
    if (keys.length === 0) return false;
    const hits = keys.filter((k) => words.has(k) || words.has(`${k}s`) || (k.endsWith('s') && words.has(k.slice(0, -1)))).length;
    return keys.length === 1 ? hits === 1 && keys[0].length > 5 : hits / keys.length >= 0.67;
  });
}
