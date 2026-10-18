import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { COMPANIONS, Playground } from '@/components/pixel-companion';
import { T, font, monoBold, radius } from '@/constants/trajectory';
import { clock, minutesLabel, type CompanionKind, type StudyMode } from '@/lib/study-session';

/** A progress bar whose fill glides to its new width. */
export function ProgressBar({ value, color, track, height = 8 }: { value: number; color: string; track: string; height?: number }) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(value, 1)) * 100, { duration: 600 });
  }, [value, width]);
  const fill = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return (
    <View style={[styles.track, { height, backgroundColor: track }]}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, fill]} />
    </View>
  );
}

/** Pulsing dot shown while the clock is running. */
function LiveDot({ color }: { color: string }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withSequence(withTiming(0.25, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
    return () => cancelAnimation(o);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

type Props = {
  mode: StudyMode;
  /** What's being studied, if anything. */
  current: { label: string; studiedMs: number; targetMs: number } | null;
  breakMs: number;
  totalStudiedMs: number;
  plannedMs: number;
  doneCount: number;
  planCount: number;
  /** A task just hit today's goal. */
  celebrating: boolean;
  companion: CompanionKind;
  onCompanion: (kind: CompanionKind) => void;
  /** Start on the next unfinished item; absent when there's nothing left today. */
  onStart?: () => void;
  onBreak: () => void;
  onResume: () => void;
  onStop: () => void;
};

export function StudyTimer(p: Props) {
  const dayProgress = p.plannedMs > 0 ? p.totalStudiedMs / p.plannedMs : 0;
  const taskProgress = p.current && p.current.targetMs > 0 ? p.current.studiedMs / p.current.targetMs : 0;
  const left = p.current ? p.current.targetMs - p.current.studiedMs : 0;

  return (
    <View style={styles.card}>
      <Playground kind={p.companion} mode={p.mode} progress={dayProgress} happy={p.celebrating} />

      <View style={styles.picker}>
        {COMPANIONS.map((c) => (
          <Pressable
            key={c.kind}
            accessibilityRole="button"
            accessibilityState={{ selected: p.companion === c.kind }}
            onPress={() => p.onCompanion(c.kind)}
            style={[styles.pick, p.companion === c.kind && styles.pickOn]}>
            <Text style={[styles.pickText, p.companion === c.kind && styles.pickTextOn]}>{c.name}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.readout}>
        <View style={styles.statusRow}>
          {p.mode === 'study' ? <LiveDot color={T.accent} /> : null}
          {p.mode === 'break' ? <LiveDot color={BREAK} /> : null}
          <Text style={styles.status} numberOfLines={1}>
            {p.celebrating
              ? "Today's goal hit"
              : p.mode === 'study'
                ? 'Studying'
                : p.mode === 'break'
                  ? 'On a break'
                  : p.onStart
                    ? 'Ready when you are'
                    : 'All done for today'}
          </Text>
        </View>
        <Animated.Text key={p.mode} entering={FadeIn.duration(250)} style={[styles.clock, p.mode === 'break' && styles.clockBreak]}>
          {p.mode === 'break' ? clock(p.breakMs) : p.current ? clock(p.current.studiedMs) : clock(p.totalStudiedMs)}
        </Animated.Text>
        <Text style={styles.sub} numberOfLines={2}>
          {p.mode === 'idle' ? 'studied today' : p.mode === 'break' ? "Break time isn't counted" : p.current?.label}
        </Text>
      </View>

      {p.current && p.mode !== 'idle' ? (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.taskBlock}>
          <ProgressBar value={taskProgress} color={T.accent} track={T.track} />
          <Text style={styles.muted}>
            {minutesLabel(left)} left of {minutesLabel(p.current.targetMs)} today
          </Text>
        </Animated.View>
      ) : null}

      <View style={styles.controls}>
        {p.mode === 'idle' ? (
          p.onStart ? (
            <Btn label="Start studying" onPress={p.onStart} kind="primary" />
          ) : null
        ) : (
          <>
            {p.mode === 'study' ? (
              <Btn label="Take a break" onPress={p.onBreak} kind="primary" />
            ) : (
              <Btn label="Back to it" onPress={p.onResume} kind="primary" />
            )}
            <Btn label="Stop" onPress={p.onStop} kind="stop" />
          </>
        )}
      </View>

      <View style={styles.dayBlock}>
        <View style={styles.dayTop}>
          <Text style={styles.dayBig}>
            {minutesLabel(p.totalStudiedMs)} <Text style={styles.daySmall}>of {minutesLabel(p.plannedMs)} planned</Text>
          </Text>
          <Text style={styles.muted}>
            {p.doneCount} of {p.planCount} done
          </Text>
        </View>
        <ProgressBar value={dayProgress} color={T.accent} track={T.track} height={6} />
      </View>
    </View>
  );
}

function Btn({ label, onPress, kind }: { label: string; onPress: () => void; kind: 'primary' | 'stop' }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.btn, kind === 'primary' ? styles.btnPrimary : styles.btnStop, pressed && styles.pressed]}>
      <Text style={[styles.btnText, kind === 'primary' && styles.btnTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const BREAK = '#F2B33D';

const styles = StyleSheet.create({
  card: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: radius.lg, padding: 14, gap: 12 },
  picker: { flexDirection: 'row', alignSelf: 'center', backgroundColor: T.elevated, borderRadius: 999, padding: 3 },
  pick: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  pickOn: { backgroundColor: T.lineStrong },
  pickText: { fontSize: 12, fontWeight: '600', color: T.onDarkMuted },
  pickTextOn: { color: T.ink },

  readout: { gap: 2, paddingHorizontal: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  status: { fontFamily: font.semibold, fontSize: 14, color: T.onDarkMuted },
  dot: { width: 8, height: 8, borderRadius: 4 },
  clock: { fontFamily: monoBold, fontSize: 56, color: T.ink, letterSpacing: -2 },
  clockBreak: { color: BREAK },
  sub: { fontSize: 14, color: T.onDarkMuted },

  taskBlock: { gap: 8, paddingHorizontal: 4 },
  controls: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: T.accent },
  btnStop: { backgroundColor: '#3A2326', borderWidth: 1, borderColor: '#6B2E33' },
  btnText: { fontSize: 16, fontWeight: '700', color: T.ink },
  btnTextPrimary: { color: T.onAccent },
  pressed: { opacity: 0.7 },

  dayBlock: { gap: 8, borderTopWidth: 1, borderTopColor: T.line, paddingTop: 12, paddingHorizontal: 4 },
  dayTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  dayBig: { fontFamily: font.bold, fontSize: 22, color: T.ink },
  daySmall: { fontSize: 13, fontWeight: '500', color: T.onDarkMuted },
  muted: { fontSize: 13, color: T.onDarkMuted },

  track: { borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
});
