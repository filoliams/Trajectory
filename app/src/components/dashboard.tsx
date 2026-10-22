import { useEffect, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { PressScale } from '@/components/press-scale';
import { Text } from '@/components/ui/text';
import { T } from '@/constants/trajectory';
import { dayKey } from '@/lib/day';
import { cn } from '@/lib/utils';

const DAY_MS = 86_400_000;
const TICKS = 36;

/** A small dashboard tile: label on top, a big mono number, an optional line under it. */
export function StatCard({
  label,
  value,
  hint,
  tone = T.ink,
  index = 0,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  index?: number;
  /** Shown to the left of the text, e.g. a Ring. */
  children?: ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(18)} style={{ flexGrow: 1, flexBasis: 150 }}>
      <View className="bg-card border-border flex-1 flex-row items-center gap-3 rounded-2xl border p-4">
        {children}
        <View className="flex-1 gap-0.5">
          <Text className="text-muted-foreground font-semibold text-xs uppercase tracking-wider" numberOfLines={1}>
            {label}
          </Text>
          <Text className="font-mono text-2xl" style={{ color: tone }} numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </Text>
          {hint ? (
            <Text className="text-muted-foreground text-xs" numberOfLines={1}>
              {hint}
            </Text>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

/** A ring of ticks that light up to `value` (0–1), sweeping round when it changes. Children sit in the middle. */
export function Ring({ value, size = 56, color = T.accent, children }: { value: number; size?: number; color?: string; children?: ReactNode }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(Math.max(0, Math.min(value, 1)), { duration: 900, reduceMotion: ReduceMotion.System });
  }, [value, progress]);
  const tick = Math.max(5, size / 9);
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.max(0, Math.min(value, 1)) * 100) }}>
      {Array.from({ length: TICKS }, (_, i) => (
        <View
          key={i}
          style={{ position: 'absolute', width: size, height: size, alignItems: 'center', transform: [{ rotate: `${(i * 360) / TICKS}deg` }] }}>
          <View style={{ width: 2.5, height: tick, borderRadius: 2, backgroundColor: T.track, overflow: 'hidden' }}>
            <Lit i={i} progress={progress} color={color} />
          </View>
        </View>
      ))}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  );
}

function Lit({ i, progress, color }: { i: number; progress: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => ({ opacity: progress.value * TICKS > i ? 1 : 0 }));
  return <Animated.View style={[{ flex: 1, backgroundColor: color }, style]} />;
}

/** The next seven days, each with a dot per deadline. Tap a day to filter; tap it again to clear. */
export function WeekStrip({
  now,
  counts,
  selected,
  onSelect,
}: {
  now: number;
  /** Deadlines per Brisbane day key. */
  counts: Map<string, number>;
  selected: string | null;
  onSelect: (day: string | null) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => now + i * DAY_MS);
  return (
    <View className="flex-row gap-1.5">
      {days.map((ms, i) => {
        const key = dayKey(ms);
        const on = selected === key;
        const n = counts.get(key) ?? 0;
        const weekday = new Date(ms).toLocaleDateString('en-AU', { weekday: 'short', timeZone: 'Australia/Brisbane' });
        const date = new Date(ms).toLocaleDateString('en-AU', { day: 'numeric', timeZone: 'Australia/Brisbane' });
        return (
          <PressScale
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${i === 0 ? 'Today' : weekday} ${date}, ${n} due`}
            onPress={() => onSelect(on ? null : key)}
            style={{ flex: 1 }}>
            <View className={cn('items-center gap-1 rounded-xl border py-2', on ? 'bg-primary border-primary' : 'bg-card border-border')}>
              <Text className={cn('text-[11px] font-semibold', on ? 'text-primary-foreground' : 'text-muted-foreground')} numberOfLines={1}>
                {i === 0 ? 'Today' : weekday}
              </Text>
              <Text className={cn('font-mono text-base', on ? 'text-primary-foreground' : 'text-foreground')}>{date}</Text>
              <View className="h-1.5 flex-row gap-0.5">
                {Array.from({ length: Math.min(n, 3) }, (_, d) => (
                  <View key={d} className={cn('h-1.5 w-1.5 rounded-full', on ? 'bg-primary-foreground' : 'bg-primary')} />
                ))}
              </View>
            </View>
          </PressScale>
        );
      })}
    </View>
  );
}

/** Pill tabs; the chosen one fills with the accent. */
export function Pills<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            className={cn(
              'min-h-10 justify-center rounded-full border px-4',
              on ? 'bg-primary border-primary' : 'border-border bg-card active:bg-accent',
            )}>
            <Text className={cn('text-sm font-semibold', on ? 'text-primary-foreground' : 'text-foreground')}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A section title with an optional action on the right. */
export function SectionHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View className="min-h-10 flex-row items-center justify-between px-1">
      <Text className="font-bold text-lg tracking-tight">{title}</Text>
      {children}
    </View>
  );
}

/** Re-flows siblings smoothly when items come and go. */
export const flow = LinearTransition.springify().damping(18);
