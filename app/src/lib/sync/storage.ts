// Uses the same localStorage Supabase uses (SQLite-backed on native).
import '../session-storage';

export function readJson<V>(key: string): V | null {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as V) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is a convenience; the app still works in memory.
  }
}
