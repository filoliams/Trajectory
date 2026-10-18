import { useEffect, useState } from 'react';

import { qldHolidays, type NagerHoliday } from '@/lib/qld-holidays';
import { readJson, writeJson } from '@/lib/sync/storage';

const REFRESH_MS = 30 * 86_400_000;
type Cached = { fetchedAt: number; days: [string, string][] };

const key = (year: number) => `trajectory.holidays.${year}`;

/** One year's Queensland public holidays from Nager.Date (free, no key), cached on this device. */
async function loadYear(year: number): Promise<[string, string][]> {
  const cached = readJson<Cached>(key(year));
  if (cached && Date.now() - cached.fetchedAt < REFRESH_MS) return cached.days;
  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/AU`);
    if (!res.ok) throw new Error(`Nager.Date ${res.status}`);
    const days = [...qldHolidays((await res.json()) as NagerHoliday[])];
    writeJson(key(year), { fetchedAt: Date.now(), days } satisfies Cached);
    return days;
  } catch {
    // Offline or the service is down: an old list beats none, and none is fine.
    return cached?.days ?? [];
  }
}

/** "YYYY-MM-DD" → holiday name for this year and next (deadlines can run past New Year). */
export function useHolidays(now: number): Map<string, string> {
  const year = new Date(now).getFullYear();
  const [holidays, setHolidays] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let live = true;
    Promise.all([loadYear(year), loadYear(year + 1)]).then(([a, b]) => {
      if (live) setHolidays(new Map([...a, ...b]));
    });
    return () => {
      live = false;
    };
  }, [year]);
  return holidays;
}
