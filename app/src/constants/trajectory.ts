import { Platform } from 'react-native';

/** Trajectory's colours, matching the designs. */
export const T = {
  ground: '#F2F3F5',
  surface: '#FFFFFF',
  ink: '#15171C',
  inkSoft: '#3A3F48',
  muted: '#5A606B',
  line: '#E2E4E8',
  lineSoft: '#E9EBEE',
  accent: '#2E55E6',
  accentDark: '#1F3FB8',
  accentSoft: '#E7ECFD',
  urgent: '#B42318',
  warn: '#A84A0C',
  warnBar: '#C2560F',
  warnSoft: '#FCEBDD',
  neutralSoft: '#ECEDF0',
  onDarkMuted: '#B8BCC6',
} as const;

export const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

export const radius = { sm: 8, md: 12, lg: 16, xl: 20 } as const;
