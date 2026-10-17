/** The Brisbane calendar date for a moment, as "YYYY-MM-DD". */
export function dayKey(now: number): string {
  return new Date(now).toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' });
}
