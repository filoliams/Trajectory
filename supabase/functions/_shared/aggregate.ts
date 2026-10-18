/** A topic's level across all of a student's documents. Pure, so Node can test it. */

export type Level = 'none' | 'weak' | 'okay' | 'strong';
export const LEVELS: readonly Level[] = ['none', 'weak', 'okay', 'strong'];

export type TopicReading = { topicId: number; level: Level; reason: string };

/** Each topic's best reading: notes for a topic usually live in one notebook, so the strongest one counts. */
export function bestByTopic(readings: TopicReading[]): Map<number, TopicReading> {
  const best = new Map<number, TopicReading>();
  for (const r of readings) {
    const current = best.get(r.topicId);
    if (!current || LEVELS.indexOf(r.level) > LEVELS.indexOf(current.level)) best.set(r.topicId, r);
  }
  return best;
}
