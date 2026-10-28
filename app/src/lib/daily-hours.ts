import { useSyncExternalStore } from 'react';

import { readJson, writeJson } from '@/lib/sync/storage';

// shortcut: saved on this device only, like the companion choice; move to the profile if it should follow the account.
const KEY = 'trajectory.daily-hours';
export const DAILY_HOURS_OPTIONS = [2, 3, 4, 5, 6] as const;

let hours = readJson<number>(KEY) ?? 4;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Hours a day the student wants to study; Today's plan fits into this. */
export function useDailyHours(): [number, (h: number) => void] {
  const value = useSyncExternalStore(subscribe, () => hours, () => hours);
  return [
    value,
    (h) => {
      hours = h;
      writeJson(KEY, h);
      listeners.forEach((l) => l());
    },
  ];
}
