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

export const radius = { sm: 8, md: 12, lg: 16, xl: 20 } as const;
