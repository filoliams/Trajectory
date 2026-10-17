import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from '@/constants/trajectory';
import { useStore } from '@/lib/store';

/** A small pill while offline or while edits are waiting to be saved. Hidden otherwise. */
export function SyncStatus() {
  const { online, pendingCount, session } = useStore();
  const insets = useSafeAreaInsets();
  // Online saves usually finish in a blink; only mention them if they take a while.
  const [slow, setSlow] = useState(false);
  const waiting = online && pendingCount > 0;
  useEffect(() => {
    if (!waiting) return;
    const id = setTimeout(() => setSlow(true), 2000);
    return () => {
      clearTimeout(id);
      setSlow(false);
    };
  }, [waiting]);
  if (!session || (online && !(waiting && slow))) return null;

  const changes = `${pendingCount} change${pendingCount === 1 ? '' : 's'}`;
  const label = online ? `Saving ${changes}…` : pendingCount ? `Offline · ${changes} will sync later` : 'Offline · edits will sync later';

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 6 }]}>
      <View style={[styles.pill, !online && styles.offline]} accessibilityRole="text" accessibilityLiveRegion="polite">
        <View style={[styles.dot, { backgroundColor: online ? T.accent : T.warnBar }]} />
        <Text style={[styles.text, !online && styles.offlineText]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 100, elevation: 100 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: T.accentSoft,
  },
  offline: { backgroundColor: T.warnSoft },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12, fontWeight: '600', color: T.accentDark },
  offlineText: { color: T.warn },
});
