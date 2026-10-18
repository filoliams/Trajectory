/** Course codes like CSSE2310 in folder and file names. Pure, so Node can test it. */

// Four letters then four digits, allowing "CSSE 2310" / "csse_2310"; not part of a longer word or number.
const CODE = /(?<![A-Za-z0-9])([A-Za-z]{4})[\s_-]?(\d{4})(?![0-9])/g;

export function codesIn(text: string): string[] {
  return [...text.matchAll(CODE)].map((m) => `${m[1]}${m[2]}`.toUpperCase());
}

/**
 * The user's course this path names, or null when it names none of them or more than one.
 * Folders are checked from the file outwards, so "MATH1051/CSSE2310 notes.pdf" means CSSE2310.
 */
export function courseFromPath<C extends { code: string }>(path: string, courses: C[]): C | null {
  const segments = path.split(/[\\/]/).filter(Boolean).reverse();
  for (const segment of segments) {
    const hits = new Set(codesIn(segment).filter((code) => courses.some((c) => c.code.toUpperCase() === code)));
    if (hits.size === 1) return courses.find((c) => c.code.toUpperCase() === [...hits][0]) ?? null;
    if (hits.size > 1) return null;
  }
  return null;
}
