import { StyleSheet, Text } from 'react-native';

import type { Level, Status } from '@/data/courses';
import { T } from '@/constants/trajectory';

const LEVEL_LABEL: Record<Level, string> = { weak: 'Weak', okay: 'Okay', strong: 'Strong', none: 'No notes' };

export function LevelChip({ level }: { level: Level }) {
  return <Text style={[styles.chip, levelStyles[level]]}>{LEVEL_LABEL[level]}</Text>;
}

const STATUS_LABEL: Record<Status, string> = { not_started: 'Not started', in_progress: 'In progress', done: 'Done' };

export function StatusChip({ status }: { status: Status }) {
  return (
    <Text style={[styles.status, status === 'in_progress' ? styles.statusActive : styles.statusIdle]}>
      {STATUS_LABEL[status]}
    </Text>
  );
}

const styles = StyleSheet.create({
  chip: {
    fontSize: 12,
    fontWeight: '600',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  statusActive: { color: T.accentDark, backgroundColor: T.accentSoft },
  statusIdle: { color: T.inkSoft, backgroundColor: T.neutralSoft },
});

const levelStyles = StyleSheet.create({
  weak: { color: T.warn, backgroundColor: T.warnSoft },
  okay: { color: T.inkSoft, backgroundColor: T.neutralSoft },
  strong: { color: '#FFFFFF', backgroundColor: T.accent },
  none: { color: T.muted, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C9CDD4' },
});
