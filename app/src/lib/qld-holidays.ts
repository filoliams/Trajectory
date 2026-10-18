/** Queensland's public holidays out of Nager.Date's Australia list. No imports, so the self-check runs in plain Node. */

export type NagerHoliday = { date: string; localName: string; global: boolean; counties: string[] | null };

/** "YYYY-MM-DD" → holiday name, for days off across Australia or in Queensland. */
export function qldHolidays(list: NagerHoliday[]): Map<string, string> {
  return new Map(list.filter((h) => h.global || h.counties?.includes('AU-QLD')).map((h) => [h.date, h.localName]));
}
