/** One colour per course, picked to sit well on the dark ground next to the lime accent. */
const PALETTE = ['#C6F432', '#A78BFA', '#38BDF8', '#FB7185', '#FBBF24', '#34D399', '#FB923C', '#F472B6'];

/** A course's colour: its place among the semester's codes in A–Z order, so it stays the same on every screen. */
export function courseColor(code: string, codes: string[]): string {
  const i = [...new Set(codes)].sort().indexOf(code);
  return PALETTE[Math.max(i, 0) % PALETTE.length];
}
