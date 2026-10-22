import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { PressScale } from '@/components/press-scale';
import { ProgressBar } from '@/components/study-timer';
import { Text } from '@/components/ui/text';
import { T } from '@/constants/trajectory';
import { dayKey } from '@/lib/day';
import { minutesLabel } from '@/lib/study-session';
import { streak } from '@/lib/study-stats';
import { cn } from '@/lib/utils';

const DAY_MS = 86_400_000;
const MOTION = { reduceMotion: ReduceMotion.System };

/** Fades a card up into place, staggered by its position. */
function Rise({ index = 0, basis, grow = 1, children }: { index?: number; basis: number; grow?: number; children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(18)} style={{ flexGrow: grow, flexBasis: basis }}>
      {children}
    </Animated.View>
  );
}

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
    <Rise index={index} basis={150}>
      <View className="bg-card border-border flex-1 flex-row items-center gap-3 rounded-2xl border p-4">
        {children}
        <View className="flex-1 gap-0.5">
          <Eyebrow>{label}</Eyebrow>
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
    </Rise>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Text className="text-muted-foreground font-semibold text-xs uppercase tracking-wider" numberOfLines={1}>
      {children}
    </Text>
  );
}

/** A ring of ticks that light up to `value` (0–1), sweeping round when it changes. Children sit in the middle. */
export function Ring({ value, size = 56, color = T.accent, children }: { value: number; size?: number; color?: string; children?: ReactNode }) {
  const ticks = size > 90 ? 60 : 36;
  const clamped = Math.max(0, Math.min(value, 1));
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(clamped, { duration: 900, ...MOTION });
  }, [clamped, progress]);
  const tick = Math.max(5, size / 9);
  return (
    <View style={{ width: size, height: size }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}>
      {Array.from({ length: ticks }, (_, i) => (
        <View
          key={i}
          style={{ position: 'absolute', width: size, height: size, alignItems: 'center', transform: [{ rotate: `${(i * 360) / ticks}deg` }] }}>
          <View style={{ width: size > 90 ? 3 : 2.5, height: tick, borderRadius: 2, backgroundColor: T.track, overflow: 'hidden' }}>
            <Lit i={i} ticks={ticks} progress={progress} color={color} />
          </View>
        </View>
      ))}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  );
}

function Lit({ i, ticks, progress, color }: { i: number; ticks: number; progress: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => ({ opacity: progress.value * ticks > i ? 1 : 0 }));
  return <Animated.View style={[{ flex: 1, backgroundColor: color }, style]} />;
}

/** Today at a glance: one big ring for study time against the plan. */
export function HeroProgress({ studiedMs, plannedMs, done, total }: { studiedMs: number; plannedMs: number; done: number; total: number }) {
  const value = plannedMs > 0 ? studiedMs / plannedMs : 0;
  const pct = Math.min(100, Math.round(value * 100));
  return (
    <Rise index={0} basis={300} grow={2}>
      <View className="bg-card border-border flex-1 flex-row items-center gap-5 rounded-3xl border p-5">
        <Ring value={value} size={128}>
          <Text className="font-display text-[34px] leading-[38px] tracking-tighter">{pct}%</Text>
          <Text className="text-muted-foreground text-[11px]">of today</Text>
        </Ring>
        <View className="flex-1 gap-3">
          <View className="gap-0.5">
            <Eyebrow>Studied today</Eyebrow>
            <Text className="font-mono text-3xl">{minutesLabel(studiedMs)}</Text>
            <Text className="text-muted-foreground text-xs">of {minutesLabel(plannedMs)} planned</Text>
          </View>
          <View className="gap-1.5">
            <View className="flex-row justify-between">
              <Text className="text-xs text-[#C9CCD3]">Blocks done</Text>
              <Text className="font-mono text-xs">
                {done}/{total}
              </Text>
            </View>
            <ProgressBar value={total ? done / total : 0} color={T.accent} track={T.track} height={6} />
          </View>
        </View>
      </View>
    </Rise>
  );
}

/** Bars for the last seven days, today in lime. Tap a bar to read its total. */
export function WeekChart({ days, msByDay, index = 1 }: { days: string[]; msByDay: Map<string, number>; index?: number }) {
  const week = days.slice(-7);
  const [selected, setSelected] = useState<string | null>(null);
  const shown = selected ?? week[week.length - 1];
  // At least an hour tall, so a light day doesn't look like a full one.
  const max = Math.max(3_600_000, ...week.map((d) => msByDay.get(d) ?? 0));
  const total = week.reduce((sum, d) => sum + (msByDay.get(d) ?? 0), 0);
  return (
    <Rise index={index} basis={280} grow={2}>
      <View className="bg-card border-border flex-1 gap-3 rounded-3xl border p-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="gap-0.5">
            <Eyebrow>This week</Eyebrow>
            <Text className="font-mono text-2xl">{minutesLabel(total)}</Text>
          </View>
          <Animated.View key={shown} entering={FadeIn.duration(180)} style={{ alignItems: 'flex-end' }}>
            <Text className="text-muted-foreground text-xs">{weekday(shown, 'long')}</Text>
            <Text className="font-mono text-sm text-primary">{minutesLabel(msByDay.get(shown) ?? 0)}</Text>
          </Animated.View>
        </View>
        <View className="min-h-24 flex-1 flex-row items-end gap-2">
          {week.map((d, i) => (
            <Bar
              key={d}
              index={i}
              share={(msByDay.get(d) ?? 0) / max}
              today={i === week.length - 1}
              selected={d === shown}
              label={weekday(d, 'narrow')}
              onPress={() => setSelected(d === selected ? null : d)}
              a11y={`${weekday(d, 'long')}: ${minutesLabel(msByDay.get(d) ?? 0)}`}
            />
          ))}
        </View>
      </View>
    </Rise>
  );
}

function Bar(p: { index: number; share: number; today: boolean; selected: boolean; label: string; a11y: string; onPress: () => void }) {
  const height = useSharedValue(0);
  useEffect(() => {
    // Any study at all gets a visible bar; an empty day keeps a thin stub.
    const target = p.share > 0 ? Math.max(0.12, Math.min(p.share, 1)) : 0.04;
    height.value = withDelay(p.index * 50, withTiming(target, { duration: 600, ...MOTION }));
  }, [p.share, p.index, height]);
  const fill = useAnimatedStyle(() => ({ height: `${height.value * 100}%` }));
  const color = p.today ? T.accent : p.selected ? T.inkSoft : T.lineStrong;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={p.a11y} accessibilityState={{ selected: p.selected }} onPress={p.onPress} className="h-full flex-1 items-center gap-1.5">
      <View className="w-full flex-1 justify-end">
        <Animated.View style={[{ width: '100%', borderRadius: 6, backgroundColor: color }, fill]} />
      </View>
      <Text className={cn('text-[11px] font-semibold', p.today ? 'text-primary' : p.selected ? 'text-foreground' : 'text-muted-foreground')}>{p.label}</Text>
    </Pressable>
  );
}

/** Days in a row with some study, and the last week as a row of lit or dark days. */
export function StreakCard({ days, msByDay, index = 2 }: { days: string[]; msByDay: Map<string, number>; index?: number }) {
  const run = streak(msByDay, days);
  return (
    <Rise index={index} basis={200}>
      <View className="bg-card border-border flex-1 justify-between gap-3 rounded-3xl border p-5">
        <Eyebrow>Streak</Eyebrow>
        <View className="flex-row items-baseline gap-2">
          <Text className="font-display text-5xl leading-[52px] tracking-tighter" style={{ color: run ? T.accent : T.muted }}>
            {run}
          </Text>
          <Text className="font-serif text-2xl text-[#C9CCD3]">{run === 1 ? 'day' : 'days'}</Text>
        </View>
        <View className="flex-row gap-1.5">
          {days.slice(-7).map((d) => (
            <View key={d} className={cn('h-2 flex-1 rounded-full', (msByDay.get(d) ?? 0) > 0 ? 'bg-primary' : 'bg-secondary')} />
          ))}
        </View>
        <Text className="text-muted-foreground text-xs">{run ? 'Keep it going today.' : 'Study today to start one.'}</Text>
      </View>
    </Rise>
  );
}

/** "Mon"/"M" for a "YYYY-MM-DD" day. */
function weekday(day: string, style: 'long' | 'narrow'): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-AU', { weekday: style, timeZone: 'UTC' });
}

/** The next seven days, with a dot in its course colour per deadline. Tap a day to filter; tap it again to clear. */
export function WeekStrip({
  now,
  dots,
  selected,
  onSelect,
}: {
  now: number;
  /** Course colours of the deadlines on each Brisbane day key. */
  dots: Map<string, string[]>;
  selected: string | null;
  onSelect: (day: string | null) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => now + i * DAY_MS);
  return (
    <View className="flex-row gap-1.5">
      {days.map((ms, i) => {
        const key = dayKey(ms);
        const on = selected === key;
        const colors = dots.get(key) ?? [];
        const weekdayName = new Date(ms).toLocaleDateString('en-AU', { weekday: 'short', timeZone: 'Australia/Brisbane' });
        const date = new Date(ms).toLocaleDateString('en-AU', { day: 'numeric', timeZone: 'Australia/Brisbane' });
        return (
          <PressScale
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${i === 0 ? 'Today' : weekdayName} ${date}, ${colors.length} due`}
            onPress={() => onSelect(on ? null : key)}
            style={{ flex: 1 }}>
            <View className={cn('items-center gap-1 rounded-xl border py-2', on ? 'bg-foreground border-foreground' : 'bg-background border-border')}>
              <Text className={cn('text-[11px] font-semibold', on ? 'text-background' : 'text-muted-foreground')} numberOfLines={1}>
                {i === 0 ? 'Today' : weekdayName}
              </Text>
              <Text className={cn('font-mono text-base', on ? 'text-background' : 'text-foreground')}>{date}</Text>
              <View className="h-1.5 flex-row gap-0.5">
                {colors.slice(0, 3).map((c, d) => (
                  <View key={d} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
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
      <Text className="font-heading text-xl tracking-tight">{title}</Text>
      {children}
    </View>
  );
}

/** Re-flows siblings smoothly when items come and go. */
export const flow = LinearTransition.springify().damping(18);
