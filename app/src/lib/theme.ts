import { DarkTheme, type Theme } from 'expo-router/react-navigation';

import { T } from '@/constants/trajectory';

// Trajectory is dark only, so both modes use the same palette; the CSS variables in global.css match these.
const palette = {
  background: T.ground,
  foreground: T.ink,
  card: T.surface,
  cardForeground: T.ink,
  popover: T.elevated,
  popoverForeground: T.ink,
  primary: T.accent,
  primaryForeground: T.onAccent,
  secondary: T.neutralSoft,
  secondaryForeground: T.ink,
  muted: T.surface,
  mutedForeground: T.muted,
  accent: T.elevated,
  accentForeground: T.ink,
  destructive: T.urgent,
  border: T.line,
  input: T.lineStrong,
  ring: T.accent,
  radius: '0.875rem',
  chart1: T.accent,
  chart2: T.done,
  chart3: T.warn,
  chart4: T.urgent,
  chart5: T.muted,
};

/** Theme values for React Native Reusables components that need plain colours rather than classes. */
export const THEME = { light: palette, dark: palette };

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    background: palette.background,
    border: palette.border,
    card: palette.card,
    notification: palette.destructive,
    primary: palette.primary,
    text: palette.foreground,
  },
};

export const NAV_THEME: Record<'light' | 'dark', Theme> = { light: navTheme, dark: navTheme };
