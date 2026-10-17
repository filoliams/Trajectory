import type { CompanionKind } from '@/lib/study-session';

/**
 * Pixel art for the animal companions. One character per pixel; '.' is
 * transparent. Lowercase keys come from the shared palette, and 'b' (body),
 * 'd' (shade), 'h' (highlight) and 'e' (belly) are recoloured per critter.
 *
 * Each critter is a 24×21 base drawing plus a feet row. Faces, books and
 * tails are layered on top, so every pose shares one base.
 */
export const CRITTER_W = 24;

export type CritterKind = Exclude<CompanionKind, 'plant'>;
export type Pose = 'walk' | 'read' | 'nap' | 'idle' | 'happy';

type Layer = { rows: string[]; x: number; y: number };
type EyeSet = { open: string[]; look: string[]; shut: string[]; happy: string[] };

export type Species = {
  name: string;
  colors: { b: string; d: string; h: string; e: string };
  base: string[];
  /** Standing and mid-step feet. */
  feet: [string, string];
  eyes: EyeSet & { y: number; x: [number, number] };
  mouth: { x: number; y: number; calm: string[]; happy: string[] };
  cheeks: { y: number; x: [number, number] };
  /** Top row of the book when reading. */
  bookY: number;
  extras?: Layer[];
};

// ---- Shared parts --------------------------------------------------------

const ROUND_EYES: EyeSet = {
  open: ['.kk.', 'kwkk', 'kkkk', '.kk.'],
  look: ['....', '.kk.', 'kwkk', '.kk.'], // glancing down at the book
  shut: ['....', '....', 'k..k', '.kk.'],
  happy: ['....', '.kk.', 'k..k', '....'],
};

const CHEEK = ['pp'];

// An open book held in both paws; frame B moves on to the next lines.
const BOOK_A = [
  '..kkkkkk..kkkkkk..',
  '.kyyyyyykkyyyyyyk.',
  '.kyllllykkyllllyk.',
  'kbkyyyyykkylllykbk',
  'kbbrrrrrrrrrrrrbbk',
  '.kkkkkkkkkkkkkkkk.',
];
const BOOK_B = [
  '..kkkkkk..kkkkkk..',
  '.kyllllykkyyyyyyk.',
  '.kyyyyyykkylllyyk.',
  'kbkylllykkyllllkbk',
  'kbbrrrrrrrrrrrrbbk',
  '.kkkkkkkkkkkkkkkk.',
];
const BOOK_X = 3;

// ---- Critters ------------------------------------------------------------

export const SPECIES: Record<CritterKind, Species> = {
  critter: {
    name: 'Blob',
    colors: { b: '#7D97FF', d: '#4F6FE8', h: '#B3C2FF', e: '#A9BAFF' },
    base: [
      '...........kk...........',
      '..........khbk..........',
      '.........khbbbk.........',
      '........khbbbbbk........',
      '......kkhhbbbbbbkk......',
      '....kkhhbbbbbbbbbbkk....',
      '...kwwhbbbbbbbbbbbbbk...',
      '..khwhbbbbbbbbbbbbbbbk..',
      '..khbbbbbbbbbbbbbbbbbk..',
      '.khbbbbbbbbbbbbbbbbbbbk.',
      '.kbbbbbbbbbbbbbbbbbbbbk.',
      '.kbbbbbbbbbbbbbbbbbbbbk.',
      'kbbbbbbbbbbbbbbbbbbbbbbk',
      'kbbbbbbbbbbbbbbbbbbbbbbk',
      'kbbbbbbbbbbbbbbbbbbbbbbk',
      'kbbbbbbbbbbbbbbbbbbbbbdk',
      'kbbbbbbbbbbbbbbbbbbbbbdk',
      'kdbbbbbbbbbbbbbbbbbbbddk',
      'kddbbbbbbbbbbbbbbbbbdddk',
      '.kddddddddddddddddddddk.',
      '..kkkkkkkkkkkkkkkkkkkk..',
    ],
    feet: ['....kddk........kddk....', '.....kddk......kddk.....'],
    eyes: { ...ROUND_EYES, y: 9, x: [5, 15] },
    mouth: { x: 10, y: 13, calm: ['k..k', '.kk.'], happy: ['kkkk', 'knnk', '.kk.'] },
    cheeks: { y: 13, x: [3, 19] },
    bookY: 15,
  },
  cat: {
    name: 'Cat',
    colors: { b: '#F2A65A', d: '#C9711F', h: '#FFC98C', e: '#FFE6C7' },
    base: [
      '........................',
      '..kk................kk..',
      '..kbk..............kbk..',
      '..knbk............kbnk..',
      '..knnbkkkkkkkkkkkkbnnk..',
      '..kbbbbbbbdbbdbbbbbbbk..',
      '.khbbbbbbbbddbbbbbbbbbk.',
      '.khhbbbbbbbbbbbbbbbbbbk.',
      'khbbbbbbbbbbbbbbbbbbbbbk',
      'kbbbbbbbbbbbbbbbbbbbbbbk',
      'kbbbbbbbbbbbbbbbbbbbbbbk',
      'kbbbbbbbbbbbbbbbbbbbbbbk',
      'kddbbbbbbbbbbbbbbbbbbddk',
      'kbbbbbbbeeeeeeeebbbbbbbk',
      'kddbbbeeeeeeeeeeeebbbddk',
      '.kbbbbeeeeeeeeeeeebbbbk.',
      '..kkbbbbbbbbbbbbbbbbkk..',
      '...kbbbbeeeeeeeebbbbk...',
      '...kdbbeeeeeeeeeebbdk...',
      '...kddbeeeeeeeeeebddk...',
      '...kkkkkkkkkkkkkkkkkk...',
    ],
    feet: ['.....kbbk......kbbk.....', '......kbbk....kbbk......'],
    eyes: { ...ROUND_EYES, y: 8, x: [5, 15] },
    mouth: { x: 9, y: 12, calm: ['..nn..', 'k.kk.k', '.k..k.'], happy: ['..nn..', 'k.kk.k', '.knnk.'] },
    cheeks: { y: 13, x: [3, 19] },
    bookY: 15,
    // A striped tail curling up behind the right hip.
    extras: [{ x: 19, y: 13, rows: ['...kk', '..kdk', '..kbk', '..kdk', '.kbk.', '.bk..'] }],
  },
  frog: {
    name: 'Frog',
    colors: { b: '#6CCB5F', d: '#3E9E3A', h: '#A4E696', e: '#E3F5B5' },
    base: [
      '........................',
      '..kkkkkk........kkkkkk..',
      '.kbbbbbbk......kbbbbbbk.',
      'kbbbbbbbbk....kbbbbbbbbk',
      'kbbbbbbbbbkkkkbbbbbbbbbk',
      'khhbbbbbbbbbbbbbbbbbbbbk',
      'khbbbbbbbbkbbkbbbbbbbbdk',
      'kbbbbbbbbbbbbbbbbbbbbbdk',
      'kbbbbbbbbbbbbbbbbbbbbbbk',
      'kbbbbbbbbbbbbbbbbbbbbbbk',
      'kbbdbbbbbbbbbbbbbbbbdbbk',
      'kbddbbbbbbbbbbbbbbbbddbk',
      '.kbbbbbbbbbbbbbbbbbbbbk.',
      '..kbbbbbbbbbbbbbbbbbbk..',
      '.kbbkbeeeeeeeeeeeebkbbk.',
      'kbbbkbeeeeeeeeeeeebkbbbk',
      'kbbbkbeeeeeeeeeeeebkbbbk',
      'kbbdkbeeeeeeeeeeeebkdbbk',
      'kbddkbbeeeeeeeeeebbkddbk',
      '.kddkdbbbbbbbbbbbbdkddk.',
      '..kkkkkkkkkkkkkkkkkkkk..',
    ],
    feet: ['kbkbk....kk..kk....kbkbk', 'kbkbk...kk....kk...kbkbk'],
    eyes: {
      open: ['.wwww.', 'wwwkkw', 'wwwkkw', '.wwww.'],
      look: ['......', '......', 'kkkkkk', '.wkkw.'],
      shut: ['......', '......', 'kkkkkk', '......'],
      happy: ['......', '.kkkk.', 'k....k', '......'],
      y: 1,
      x: [2, 16],
    },
    mouth: {
      x: 4,
      y: 8,
      calm: ['k..............k', '.kkkkkkkkkkkkkk.'],
      happy: ['k..............k', '.kkkkkkkkkkkkkk.', '..knnnnnnnnnnk..', '...kkkkkkkkkk...'],
    },
    cheeks: { y: 8, x: [2, 20] },
    bookY: 14,
  },
};

// ---- Frames --------------------------------------------------------------

/** Paint a layer over rows; '.' in the layer leaves what is underneath. */
function paint(rows: string[], { rows: layer, x, y }: Layer): string[] {
  return rows.map((row, i) => {
    const src = layer[i - y];
    if (src === undefined) return row;
    let out = row;
    for (let j = 0; j < src.length; j++) {
      if (src[j] !== '.' && x + j < row.length) out = out.slice(0, x + j) + src[j] + out.slice(x + j + 1);
    }
    return out;
  });
}

type Look = keyof EyeSet;

function draw(s: Species, look: Look, opts: { feet?: 0 | 1; book?: string[]; grin?: boolean } = {}): string[] {
  const { eyes, mouth, cheeks } = s;
  const layers: Layer[] = [
    ...(s.extras ?? []),
    { rows: eyes[look], x: eyes.x[0], y: eyes.y },
    { rows: eyes[look], x: eyes.x[1], y: eyes.y },
    { rows: CHEEK, x: cheeks.x[0], y: cheeks.y },
    { rows: CHEEK, x: cheeks.x[1], y: cheeks.y },
    { rows: opts.grin ? mouth.happy : mouth.calm, x: mouth.x, y: mouth.y },
  ];
  if (opts.book) layers.push({ rows: opts.book, x: BOOK_X, y: s.bookY });
  const rows = [...s.base, s.feet[opts.feet ?? 0]];
  return layers.reduce(paint, rows);
}

const BLANK = '.'.repeat(CRITTER_W);

export function critterFrames(s: Species, pose: Pose): string[][] {
  switch (pose) {
    case 'walk':
      return [draw(s, 'open', { feet: 0 }), draw(s, 'open', { feet: 1 })];
    case 'read':
      return [draw(s, 'look', { book: BOOK_A }), draw(s, 'look', { book: BOOK_B })];
    case 'nap':
      // Feet tucked under and sunk a row: lying low for a nap.
      return [[BLANK, ...draw(s, 'shut').slice(0, -1)]];
    case 'happy':
      return [draw(s, 'happy', { grin: true })];
    case 'idle':
      return [draw(s, 'open'), draw(s, 'shut')];
  }
}
