/** The last data this device saw, so the app opens straight away and works with no network. */
import type { Course } from '@/data/courses';

import { readJson, writeJson } from './storage';

export type Profile = { semester: string; onboarded: boolean };

/** Study time per assessment id, for one Brisbane day. */
export type StudyDay = { day: string; ms: Record<string, number> };

export type Snapshot = { profile: Profile | null; courses: Course[]; study: StudyDay | null };

const key = (userId: string) => `trajectory.cache.${userId}`;

export function readCache(userId: string): Snapshot | null {
  return readJson<Snapshot>(key(userId));
}

export function writeCache(userId: string, snapshot: Snapshot) {
  writeJson(key(userId), snapshot);
}
