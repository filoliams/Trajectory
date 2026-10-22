const DAY_MS = 86_400_000;

/** The `n` calendar days ending on `today` ("YYYY-MM-DD"), oldest first. */
export function daysEnding(today: string, n: number): string[] {
  const end = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(end - (n - 1 - i) * DAY_MS).toISOString().slice(0, 10));
}

/**
 * Days in a row with some study, counting back from today. A day with nothing yet
 * today doesn't break it: the run from yesterday still stands until today is over.
 */
export function streak(msByDay: Map<string, number>, days: string[]): number {
  const studied = (d: string) => (msByDay.get(d) ?? 0) > 0;
  let i = days.length - 1;
  if (i >= 0 && !studied(days[i])) i--;
  let run = 0;
  while (i >= 0 && studied(days[i])) {
    run++;
    i--;
  }
  return run;
}
