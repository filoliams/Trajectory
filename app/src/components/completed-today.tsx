import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { T, mono, radius } from '@/constants/trajectory';
import { minutesLabel } from '@/lib/study-session';

export type Finished = { id: string; name: string; code: string; studied: number };

/** Collapsible list of everything finished today. */
export function CompletedToday({ items }: { items: Finished[] }) {
  const [open, setOpen] = useState(false);
  const turn = useSharedValue(0);
  useEffect(() => {
    turn.value = withTiming(open ? 1 : 0, { duration: 200 });
  }, [open, turn]);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  const total = items.reduce((sum, i) => sum + i.studied, 0);

  return (
    <View style={styles.doneBox}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [styles.doneHeader, pressed && styles.pressed]}>
        <View style={styles.doneCheck}>
          <Text style={styles.doneCheckText}>✓</Text>
        </View>
        <Text style={styles.doneTitle}>
          Completed today <Text style={styles.doneCount}>({items.length})</Text>
        </Text>
        <Text style={styles.doneTotal}>{minutesLabel(total)}</Text>
        <Animated.Text style={[styles.chevron, chevron]}>⌄</Animated.Text>
      </Pressable>
      {open
        ? items.map((item, i) => (
            <Animated.View key={item.id} entering={FadeInDown.delay(i * 40)} exiting={FadeOut.duration(120)} style={styles.doneRow}>
              <View style={styles.doneRowText}>
                <Text style={styles.doneName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.doneMeta}>{item.code}</Text>
              </View>
              <Text style={styles.doneTime}>{minutesLabel(item.studied)}</Text>
            </Animated.View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  doneBox: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: radius.lg, overflow: 'hidden' },
  doneHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  doneCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: T.done, alignItems: 'center', justifyContent: 'center' },
  doneCheckText: { color: T.onAccent, fontSize: 13, fontWeight: '700' },
  doneTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: T.ink },
  doneCount: { color: T.muted, fontWeight: '500' },
  doneTotal: { fontFamily: mono, fontSize: 13, color: T.muted },
  chevron: { fontSize: 18, color: T.muted, lineHeight: 20 },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
  },
  doneRowText: { flex: 1, gap: 2 },
  doneName: { fontSize: 15, color: T.ink },
  doneMeta: { fontFamily: mono, fontSize: 12, color: T.muted },
  doneTime: { fontFamily: mono, fontSize: 13, color: T.done, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
