
/** Trajectory's colours: dark-first, with a lime accent. */
export const T = {
  ground: '#0B0B0F',
  surface: '#16171C',
  elevated: '#202228',
  ink: '#F4F5F7',
  inkSoft: '#C9CCD3',
  muted: '#8B909A',
  placeholder: '#5E636D',
  line: '#26282F',
  lineSoft: '#1E2026',
  lineStrong: '#3A3D46',
  track: '#2A2C33',
  accent: '#C6F432',
  accentDark: '#D8FF6A',
  accentSoft: '#1F2610',
  onAccent: '#0B0B0F',
  urgent: '#FF6B5E',
  dangerLine: '#5A2A2A',
  warn: '#FFB547',
  warnBar: '#FF9F2E',
  warnSoft: '#2E2210',
  neutralSoft: '#23252C',
  done: '#4ADE80',
  onDarkMuted: '#8B909A',
} as const;

/** Loaded in the root layout; each weight is its own family. */
export const font = {
  /** Bricolage Grotesque: titles and headings, where the app's character shows. */
  display: 'BricolageGrotesque_800ExtraBold',
  heading: 'BricolageGrotesque_700Bold',
  /** Instrument Serif italic: one accent word at a time, never body text. */
  serif: 'InstrumentSerif_400Regular_Italic',
  /** Geist: everything you read. */
  bold: 'Geist_700Bold',
  semibold: 'Geist_600SemiBold',
} as const;

/** Numbers: countdowns, clocks, percentages. */
export const mono = 'GeistMono_600SemiBold';
export const monoBold = 'GeistMono_700Bold';

/** sm: chips and tags · md: inputs and small buttons · lg: cards · pill: buttons and badges. */
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;

/** One type scale for every screen. */
export const typo = {
  display: { fontFamily: font.display, fontSize: 40, color: T.ink, letterSpacing: -1.6 },
  title: { fontFamily: font.heading, fontSize: 22, color: T.ink, letterSpacing: -0.5 },
  heading: { fontFamily: font.heading, fontSize: 18, color: T.ink, letterSpacing: -0.3 },
  eyebrow: { fontFamily: font.semibold, fontSize: 13, color: T.muted },
} as const;

/** Screens at least this wide use two columns. */
export const WIDE = 1024;
