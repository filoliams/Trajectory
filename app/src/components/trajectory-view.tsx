import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { PressScale } from '@/components/press-scale';
import { T, font, mono, monoBold, radius, typo } from '@/constants/trajectory';
import type { Assessment, Course } from '@/data/courses';
import { byPriority, countdown, daysUntil, dueLabel, urgencyBarColor } from '@/lib/planning';

const HEIGHT = 210;
const TRAIL = 64;
const DOT = 4;
const COMET = 7;
const DAY_MS = 86_400_000;
const MIN_SPAN_DAYS = 21;
const motion = { reduceMotion: ReduceMotion.System };

/** The semester as a path in space: today at the near end, the last deadline at the far end. */
function curve(t: number) {
  'worklet';
  return { x: (t - 0.5) * 2.2, y: Math.sin(Math.PI * t) * 0.55, z: t * 1.6 - 0.5 };
}

/** Perspective projection of a point on the path, turned by `yaw` radians around the vertical axis. */
function project(t: number, yaw: number, w: number) {
  'worklet';
  const p = curve(t);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const x = p.x * c - p.z * s;
  const z = p.x * s + p.z * c;
  const scale = 2.6 / (2.6 + z);
  return {
    x: w / 2 + x * scale * w * 0.3,
    y: HEIGHT * 0.8 - (p.y * HEIGHT * 0.9 + z * 40) * scale,
    scale,
    z,
  };
}

type Item = { assessment: Assessment; course: Course; t: number };

/**
 * Every upcoming deadline, laid along the semester's path in 3D. The path turns
 * slowly; tap a deadline to see it. Motion stops when the system asks for less.
 */
export function TrajectoryView({ courses, now }: { courses: Course[]; now: number }) {
  const [w, setW] = useState(0);
  const dated = courses
    .flatMap((course) => byPriority(course.assessments, now).map((assessment) => ({ course, assessment })))
    .sort((a, b) => daysUntil(a.assessment.due, now) - daysUntil(b.assessment.due, now));
  const spanDays = Math.max(MIN_SPAN_DAYS, ...dated.map((d) => Math.ceil(daysUntil(d.assessment.due, now))));
  const items: Item[] = dated.map((d) => ({ ...d, t: Math.min(1, Math.max(0.05, daysUntil(d.assessment.due, now) / spanDays)) }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((i) => i.assessment.id === selectedId) ?? items[0];

  const yaw = useSharedValue(-0.3);
  const reveal = useSharedValue(0);
  const comet = useSharedValue(0);
  useEffect(() => {
    const ease = { duration: 8000, easing: Easing.inOut(Easing.sin), ...motion };
    yaw.value = withRepeat(withSequence(withTiming(0.3, ease), withTiming(-0.3, ease)), -1, false, undefined, ReduceMotion.System);
    reveal.value = withTiming(1.1, { duration: 1600, easing: Easing.out(Easing.cubic), ...motion });
    comet.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.quad), ...motion }),
      -1,
      false,
      undefined,
      ReduceMotion.System,
    );
  }, [yaw, reveal, comet]);

  const end = new Date(now + spanDays * DAY_MS).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Australia/Brisbane',
  });

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Your trajectory</Text>
        <Text style={styles.sub}>
          {items.length
            ? `${items.length} deadline${items.length === 1 ? '' : 's'} over the next ${Math.round(spanDays / 7)} weeks`
            : 'Add assessments with due dates to see your semester laid out.'}
        </Text>
      </View>

      <View
        style={styles.stage}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        accessibilityLabel={`Semester path with ${items.length} upcoming deadlines`}>
        {w > 0 ? (
          <>
            {Array.from({ length: TRAIL }, (_, i) => (
              <TrailDot key={i} t={i / (TRAIL - 1)} yaw={yaw} reveal={reveal} w={w} />
            ))}
            <Comet progress={comet} yaw={yaw} w={w} />
            <NowMarker yaw={yaw} w={w} />
            {items.map((item) => (
              <Node
                key={item.assessment.id}
                item={item}
                now={now}
                yaw={yaw}
                reveal={reveal}
                w={w}
                selected={item === selected}
                onSelect={() => setSelectedId(item.assessment.id)}
              />
            ))}
          </>
        ) : null}
      </View>
      <View style={styles.axisRow}>
        <Text style={styles.axis}>Today</Text>
        <Text style={styles.axis}>{end}</Text>
      </View>

      {selected ? (
        <View style={styles.detail}>
          <View style={styles.detailText}>
            <Text style={styles.detailCode}>
              {selected.course.code} · {selected.assessment.weight}%
            </Text>
            <Text style={styles.detailName} numberOfLines={1}>
              {selected.assessment.name}
            </Text>
            <Text style={styles.detailDue}>{dueLabel(selected.assessment.due)}</Text>
          </View>
          <View style={styles.detailRight}>
            <Text style={[styles.detailCountdown, { color: urgencyBarColor(daysUntil(selected.assessment.due, now)) }]}>
              {countdown(selected.assessment.due, now).split(' ').slice(0, 2).join(' ')}
            </Text>
            <PressScale
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/course/[code]', params: { code: selected.course.code } })}
              style={styles.open}>
              <Text style={styles.openText}>Open</Text>
            </PressScale>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function TrailDot({ t, yaw, reveal, w }: { t: number; yaw: SharedValue<number>; reveal: SharedValue<number>; w: number }) {
  // Size changes go through transform (no layout per frame).
  const style = useAnimatedStyle(() => {
    const p = project(t, yaw.value, w);
    const shown = Math.min(1, Math.max(0, (reveal.value - t) * 6));
    return {
      opacity: shown * (0.25 + 0.45 * p.scale),
      transform: [{ translateX: p.x - DOT / 2 }, { translateY: p.y - DOT / 2 }, { scale: (3.2 * p.scale) / DOT }],
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

/** A spark that keeps travelling the path: the signature move. */
function Comet({ progress, yaw, w }: { progress: SharedValue<number>; yaw: SharedValue<number>; w: number }) {
  const style = useAnimatedStyle(() => {
    const p = project(progress.value, yaw.value, w);
    return {
      opacity: Math.sin(Math.PI * progress.value) * 0.9,
      transform: [{ translateX: p.x - COMET / 2 }, { translateY: p.y - COMET / 2 }, { scale: p.scale }],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.comet, style]} />;
}

function NowMarker({ yaw, w }: { yaw: SharedValue<number>; w: number }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad), ...motion }),
      -1,
      false,
      undefined,
      ReduceMotion.System,
    );
  }, [pulse]);
  const at = useAnimatedStyle(() => {
    const p = project(0, yaw.value, w);
    return { transform: [{ translateX: p.x - 9 }, { translateY: p.y - 9 }] };
  });
  const ring = useAnimatedStyle(() => ({ opacity: 0.7 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 1.6 }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.now, at]}>
      <Animated.View style={[styles.nowRing, ring]} />
      <View style={styles.nowCore} />
    </Animated.View>
  );
}

function Node({
  item,
  now,
  yaw,
  reveal,
  w,
  selected,
  onSelect,
}: {
  item: Item;
  now: number;
  yaw: SharedValue<number>;
  reveal: SharedValue<number>;
  w: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const base = 12 + Math.min(item.assessment.weight, 50) / 3;
  const color = urgencyBarColor(daysUntil(item.assessment.due, now));
  const { t } = item;
  const style = useAnimatedStyle(() => {
    const p = project(t, yaw.value, w);
    const pop = Math.min(1, Math.max(0, (reveal.value - t) * 5));
    return {
      zIndex: Math.round(300 - p.z * 100),
      transform: [{ translateX: p.x - base / 2 }, { translateY: p.y - base / 2 }, { scale: p.scale * (selected ? 1.3 : 1) * pop }],
    };
  });
  return (
    <Animated.View style={[styles.node, { width: base, height: base }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.course.code} ${item.assessment.name}, ${countdown(item.assessment.due, now)}`}
        accessibilityState={{ selected }}
        hitSlop={12}
        onPress={onSelect}
        style={[styles.nodeFill, { backgroundColor: color }, selected && styles.nodeSelected]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
    overflow: 'hidden',
  },
  head: { gap: 4 },
  title: typo.heading,
  sub: { fontSize: 13, color: T.muted },
  stage: { height: HEIGHT, marginHorizontal: -16 },
  dot: { position: 'absolute', left: 0, top: 0, width: DOT, height: DOT, borderRadius: 999, backgroundColor: T.inkSoft },
  comet: { position: 'absolute', left: 0, top: 0, width: COMET, height: COMET, borderRadius: 999, backgroundColor: T.accent },
  now: { position: 'absolute', left: 0, top: 0, width: 18, height: 18, alignItems: 'center', justifyContent: 'center', zIndex: 400 },
  nowRing: { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: T.accent },
  nowCore: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.accent },
  node: { position: 'absolute', left: 0, top: 0 },
  nodeFill: { flex: 1, borderRadius: 999, borderWidth: 2, borderColor: T.surface },
  nodeSelected: { borderColor: T.ink },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  axis: { fontFamily: mono, fontSize: 11, color: T.muted },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.elevated, borderRadius: radius.md, padding: 12 },
  detailText: { flex: 1, gap: 2 },
  detailCode: { fontSize: 12, fontWeight: '700', color: T.muted },
  detailName: { fontFamily: font.bold, fontSize: 17, color: T.ink },
  detailDue: { fontSize: 13, color: T.muted },
  detailRight: { alignItems: 'flex-end', gap: 8 },
  detailCountdown: { fontFamily: monoBold, fontSize: 18 },
  open: { backgroundColor: T.accent, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6 },
  openText: { fontSize: 13, fontWeight: '700', color: T.onAccent },
});
