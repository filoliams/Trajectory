import { Platform } from 'react-native';

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

export const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** sm: chips and tags · md: inputs and small buttons · lg: cards · pill: buttons and badges. */
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;

/** One type scale for every screen. */
export const typo = {
  display: { fontSize: 38, fontWeight: '800', color: T.ink, letterSpacing: -1.2 },
  title: { fontSize: 22, fontWeight: '700', color: T.ink, letterSpacing: -0.4 },
  heading: { fontSize: 18, fontWeight: '700', color: T.ink, letterSpacing: -0.2 },
  eyebrow: { fontSize: 12, fontWeight: '700', color: T.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
} as const;
