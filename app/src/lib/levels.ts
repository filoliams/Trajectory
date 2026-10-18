/** A course's Weak/Okay/Strong level from its topics. No imports, so the self-check runs in plain Node. */

export type Understanding = 'none' | 'weak' | 'okay' | 'strong';
export type CourseLevel = 'none' | 'weak' | 'okay' | 'strong';

const SCORE: Record<Understanding, number> = { none: 0, weak: 1, okay: 2, strong: 3 };

/**
 * Once at least half the topics have been analysed from notes, the course level is their average
 * (under 1 weak, under 2 okay, otherwise strong). Until then it falls back to how many topics have
 * notes at all. "none" means the course has no topics yet.
 */
export function courseLevel(topics: { hasNotes: boolean; understanding: Understanding | null }[]): CourseLevel {
  if (topics.length === 0) return 'none';
  const analysed = topics.filter((t) => t.understanding !== null);
  if (analysed.length * 2 >= topics.length) {
    const average = analysed.reduce((sum, t) => sum + SCORE[t.understanding!], 0) / analysed.length;
    return average < 1 ? 'weak' : average < 2 ? 'okay' : 'strong';
  }
  const covered = topics.filter((t) => t.hasNotes).length / topics.length;
  return covered < 0.4 ? 'weak' : covered < 0.75 ? 'okay' : 'strong';
}
