import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LevelChip } from '@/components/chips';
import { Pills, Ring, StatCard, flow } from '@/components/dashboard';
import { Button, ErrorText } from '@/components/form';
import { PressScale } from '@/components/press-scale';
import { Text } from '@/components/ui/text';
import { T, WIDE } from '@/constants/trajectory';
import type { Course } from '@/data/courses';
import { courseColor } from '@/lib/course-colors';
import { byPriority, countdown, daysUntil, notesLevel, percentToGo, shareDone, urgencyColor, useNow } from '@/lib/planning';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'week' | 'notes';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'week', label: 'Due this week' },
  { value: 'notes', label: 'Needs notes' },
];
const GAP = 12;

export default function CoursesScreen() {
  const { courses, loading, error, reload, profile } = useStore();
  const now = useNow();
  const width = useWindowDimensions().width;
  const wide = width >= WIDE;
  const [filter, setFilter] = useState<Filter>('all');

  // Phone: one column; tablet: two; desktop: three. The tab rail takes 208px on wide screens.
  const cols = wide ? 3 : width >= 640 ? 2 : 1;
  const inner = Math.min(width - (wide ? 208 : 0), wide ? 1400 : 1000) - (wide ? 80 : 32);
  const cellWidth = (inner - GAP * (cols - 1)) / cols;

  const dueThisWeek = (c: Course) => byPriority(c.assessments, now).filter((a) => daysUntil(a.due, now) < 7).length;
  const shown = courses.filter((c) =>
    filter === 'week' ? dueThisWeek(c) > 0 : filter === 'notes' ? ['weak', 'none'].includes(notesLevel(c)) : true,
  );
  const totalDue = courses.reduce((sum, c) => sum + dueThisWeek(c), 0);
  const avgDone = courses.length ? courses.reduce((sum, c) => sum + shareDone(c), 0) / courses.length : 0;
  const open = courses.reduce((sum, c) => sum + byPriority(c.assessments, now).length, 0);

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView
        contentContainerClassName={cn('w-full self-center gap-5 px-4 pb-10 pt-3', wide ? 'max-w-[1400px] px-10 pt-7' : 'max-w-[1000px]')}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={T.accent} />}>
        <View className="flex-row items-end justify-between gap-3 px-1">
          <View className="flex-1 gap-0.5">
            <Text className="text-muted-foreground text-sm">{profile?.semester.replace(' S', ', Semester ')}</Text>
            <Text className="font-display text-[44px] leading-[48px] tracking-tighter">
              Your <Text className="font-serif text-[48px] text-primary">courses</Text>
            </Text>
          </View>
          <PressScale accessibilityRole="button" accessibilityLabel="Add course" onPress={() => router.push('/course/add')}>
            <View className="bg-primary h-11 flex-row items-center gap-1.5 rounded-full px-4">
              <Text className="text-primary-foreground text-xl leading-6">+</Text>
              <Text className="text-primary-foreground text-[15px] font-semibold">Add course</Text>
            </View>
          </PressScale>
        </View>

        <ErrorText>{error}</ErrorText>

        {courses.length > 0 ? (
          <View className="flex-row flex-wrap gap-3">
            <StatCard index={0} label="Semester done" value={`${Math.round(avgDone * 100)}%`} hint="of graded work, on average">
              <Ring value={avgDone} size={52} />
            </StatCard>
            <StatCard index={1} label="Courses" value={String(courses.length)} hint={`${open} assessments open`} />
            <StatCard index={2} label="Due this week" value={String(totalDue)} tone={totalDue ? T.warn : T.ink} hint="across every course" />
          </View>
        ) : null}

        {courses.length > 0 ? <Pills options={FILTERS} value={filter} onChange={setFilter} /> : null}

        {courses.length === 0 && loading ? (
          <View className="gap-3">
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : null}

        {courses.length === 0 && !loading ? (
          <View className="bg-card border-border gap-3 rounded-2xl border p-5">
            <Text className="font-bold text-lg">No courses yet</Text>
            <Text className="text-muted-foreground text-sm">Add a course and we’ll import its assessments.</Text>
            <Button title="Add a course" onPress={() => router.push('/course/add')} />
          </View>
        ) : null}

        {courses.length > 0 && shown.length === 0 ? (
          <Text className="text-muted-foreground px-1 text-sm">No courses match. Try another filter.</Text>
        ) : null}

        <View className="flex-row flex-wrap" style={{ gap: GAP }}>
          {shown.map((course, i) => (
            <Animated.View
              key={course.id}
              entering={FadeInDown.delay(i * 60)
                .springify()
                .damping(18)}
              layout={flow}
              style={{ width: cellWidth }}>
              <CourseCard course={course} now={now} color={courseColor(course.code, courses.map((c) => c.code))} />
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CourseCard({ course, now, color }: { course: Course; now: number; color: string }) {
  const done = shareDone(course);
  const next = byPriority(course.assessments, now)[0];
  const totalWeight = course.assessments.reduce((sum, a) => sum + a.weight, 0);
  return (
    <PressScale accessibilityRole="button" onPress={() => router.push({ pathname: '/course/[code]', params: { code: course.code } })}>
      <View className="bg-card border-border gap-4 overflow-hidden rounded-3xl border p-4">
        {/* A wash of the course colour across the top edge. */}
        <View className="absolute left-0 right-0 top-0 h-1" style={{ backgroundColor: color }} />
        <View className="flex-row items-center gap-3">
          <Ring value={done} size={54} color={color}>
            <Text className="font-mono text-[11px]">{Math.round(done * 100)}%</Text>
          </Ring>
          <View className="flex-1 gap-0.5">
            <Text className="font-heading text-2xl tracking-tight">{course.code}</Text>
            {course.name ? (
              <Text className="text-muted-foreground text-[13px]" numberOfLines={1}>
                {course.name}
              </Text>
            ) : null}
          </View>
          <LevelChip level={notesLevel(course)} />
        </View>

        {next ? (
          <View className="bg-popover flex-row items-center gap-2 rounded-xl px-3 py-2.5">
            <Text className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">Next</Text>
            <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>
              {next.name}
            </Text>
            <Text className="font-mono text-[13px]" style={{ color: urgencyColor(daysUntil(next.due, now)) }}>
              {countdown(next.due, now)}
            </Text>
          </View>
        ) : (
          <View className="bg-popover rounded-xl px-3 py-2.5">
            <Text className="text-muted-foreground text-sm">Nothing coming up.</Text>
          </View>
        )}

        {/* Each assessment as a slice of the grade: course colour when done, half-strength in progress. */}
        <View className="gap-1.5">
          <View className="h-2 flex-row gap-0.5 overflow-hidden rounded-full">
            {totalWeight > 0 ? (
              course.assessments.map((a) => (
                <View
                  key={a.id}
                  style={{
                    flex: Math.max(a.weight, 1),
                    backgroundColor: a.status === 'done' ? color : a.status === 'in_progress' ? `${color}80` : T.track,
                  }}
                />
              ))
            ) : (
              <View className="flex-1" style={{ backgroundColor: T.track }} />
            )}
          </View>
          <View className="flex-row justify-between">
            <Text className="text-muted-foreground text-xs">
              {course.assessments.length} assessment{course.assessments.length === 1 ? '' : 's'}
            </Text>
            <Text className="font-mono text-xs text-[#C9CCD3]">{percentToGo(course)}% to go</Text>
          </View>
        </View>
      </View>
    </PressScale>
  );
}

/** A course card's shape, breathing while the first load finishes. */
function SkeletonCard() {
  const pulse = useSharedValue(0.5);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 800, reduceMotion: ReduceMotion.System }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View style={style} accessibilityLabel="Loading courses">
      <View className="bg-card gap-3 rounded-2xl p-4">
        <View className="bg-popover h-[22px] w-[120px] rounded-md" />
        <View className="bg-popover h-11 rounded-xl" />
        <View className="bg-popover h-1.5 rounded-md" />
      </View>
    </Animated.View>
  );
}
