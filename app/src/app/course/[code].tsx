import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LevelChip, StatusChip } from '@/components/chips';
import { Ring, SectionHead, StatCard, flow } from '@/components/dashboard';
import { TopicList } from '@/components/topic-list';
import { Text } from '@/components/ui/text';
import { T, WIDE } from '@/constants/trajectory';
import type { Assessment } from '@/data/courses';
import {
  byPriority,
  countdown,
  daysUntil,
  dueLabel,
  finishedOrPast,
  hoursLabel,
  notesLevel,
  percentToGo,
  shareDone,
  undated,
  urgencyBarColor,
  urgencyColor,
  useNow,
  whyLabel,
} from '@/lib/planning';
import { courseColor } from '@/lib/course-colors';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export default function CourseDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { courses, loading, reload, setStatus } = useStore();
  const course = courses.find((c) => c.code === code);
  const now = useNow();
  const wide = useWindowDimensions().width >= WIDE;
  // The top item starts open; tapping a card opens or closes its actions.
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);

  if (!course) {
    return (
      <SafeAreaView className="bg-background flex-1">
        <View className="gap-3 p-4">
          <BackButton />
          <Text className="text-muted-foreground text-sm">Course not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const ranked = byPriority(course.assessments, now);
  const noDate = undated(course.assessments);
  const finished = finishedOrPast(course.assessments, now);
  const workLeft = [...ranked, ...noDate].reduce((sum, a) => sum + a.hoursLeft, 0);
  const dueThisWeek = ranked.filter((a) => daysUntil(a.due, now) < 7).length;
  const openEdit = (a: Assessment) => router.push({ pathname: '/assessment/[id]', params: { id: a.id } });
  const expanded = openId === undefined ? ranked[0]?.id : openId;
  const color = courseColor(course.code, courses.map((c) => c.code));

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView
        contentContainerClassName={cn('w-full self-center gap-5 px-4 pb-10', wide ? 'max-w-[1400px] px-10 pt-5' : 'max-w-[720px]')}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={T.accent} />}>
        <View className="flex-row items-center justify-between">
          <BackButton />
          <Pressable
            accessibilityRole="button"
            className="min-h-11 justify-center rounded-full px-3 active:bg-accent"
            onPress={() => router.push({ pathname: '/course/manage', params: { code: course.code } })}>
            <Text className="text-primary text-base font-semibold">Edit</Text>
          </Pressable>
        </View>

        <View className="gap-1 px-1">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-row items-center gap-3">
              <View className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: color }} />
              <Text className="font-display text-[44px] leading-[48px] tracking-tighter">{course.code}</Text>
            </View>
            <LevelChip level={notesLevel(course)} />
          </View>
          {course.name ? <Text className="text-muted-foreground text-sm">{course.name}</Text> : null}
        </View>

        <View className="flex-row flex-wrap gap-3">
          <StatCard index={0} label="Done" value={`${Math.round(shareDone(course) * 100)}%`} hint={`${percentToGo(course)}% of the grade to go`}>
            <Ring value={shareDone(course)} size={52} color={color} />
          </StatCard>
          <StatCard index={1} label="Work left" value={hoursLabel(workLeft)} hint="estimated" />
          <StatCard index={2} label="Due this week" value={String(dueThisWeek)} tone={dueThisWeek ? T.warn : T.ink} />
        </View>

        <View className={wide ? 'flex-row items-start gap-6' : 'gap-5'}>
          <View className={cn('gap-5', wide && 'min-w-0 flex-1')}>
            <View className="gap-2.5">
              <SectionHead title="By priority">
                <Pressable
                  accessibilityRole="button"
                  className="min-h-10 justify-center rounded-full border border-border px-4 active:bg-accent"
                  onPress={() => router.push({ pathname: '/assessment/new', params: { course: course.code } })}>
                  <Text className="text-primary text-sm font-semibold">+ Add</Text>
                </Pressable>
              </SectionHead>

              {ranked.length === 0 && noDate.length === 0 ? (
                <Text className="text-muted-foreground px-1 text-sm">Nothing left to do here. Add an assessment with + Add.</Text>
              ) : null}

              {ranked.map((a, i) => {
                const days = daysUntil(a.due, now);
                const open = expanded === a.id;
                return (
                  <Animated.View key={a.id} entering={FadeInDown.delay(i * 50).springify().damping(18)} layout={flow}>
                    {/* Only the summary toggles, so the action buttons below aren't nested inside another button. */}
                    <View className={cn('bg-card rounded-2xl border p-3.5', i === 0 ? 'border-primary' : 'border-border')}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded: open }}
                        accessibilityHint="Shows actions for this assessment"
                        onPress={() => setOpenId(open ? null : a.id)}
                        className="flex-row gap-3 active:opacity-80">
                        <View className={cn('h-7 w-7 items-center justify-center rounded-lg', i === 0 ? 'bg-primary' : 'bg-secondary')}>
                          <Text className={cn('font-mono text-[13px]', i === 0 ? 'text-primary-foreground' : 'text-[#C9CCD3]')}>{i + 1}</Text>
                        </View>
                        <View className="flex-1 gap-1.5">
                          <View className="flex-row items-baseline justify-between gap-2">
                            <Text className="flex-1 font-semibold text-base">{a.name}</Text>
                            <Text className="font-mono text-sm" style={{ color: urgencyColor(days) }}>
                              {countdown(a.due, now)}
                            </Text>
                          </View>
                          <View className="flex-row justify-between gap-2">
                            <Text className="text-muted-foreground text-xs">{dueLabel(a.due)}</Text>
                            <Text className="font-mono text-xs">{a.weight}%</Text>
                          </View>
                          <View className="h-1 overflow-hidden rounded-full" style={{ backgroundColor: T.lineSoft }}>
                            <View
                              className="h-full rounded-full"
                              style={{ width: `${Math.min(Math.max(a.weight, 2), 100)}%`, backgroundColor: urgencyBarColor(days) }}
                            />
                          </View>
                          <View className="flex-row flex-wrap items-center gap-1.5">
                            <StatusChip status={a.status} />
                            <Text className="text-muted-foreground text-xs">{hoursLabel(a.hoursLeft)} left</Text>
                            {a.isHurdle ? <Badge>Hurdle</Badge> : null}
                            {a.needsReview ? <Badge warn>Check date</Badge> : null}
                          </View>
                        </View>
                      </Pressable>
                      {open ? (
                        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)} style={{ gap: 8, paddingTop: 8, paddingLeft: 40 }}>
                          <Text className="text-xs leading-[17px] text-[#C9CCD3]">{a.needsReview && a.note ? a.note : (a.why ?? whyLabel(a, now))}</Text>
                          <View className="flex-row flex-wrap gap-2">
                            <QuickButton label="Start timer" primary onPress={() => router.navigate({ pathname: '/study', params: { start: a.id } })} />
                            <QuickButton label="Mark done" onPress={() => setStatus(a.id, 'done')} />
                            <QuickButton label="Edit" onPress={() => openEdit(a)} />
                          </View>
                        </Animated.View>
                      ) : null}
                    </View>
                  </Animated.View>
                );
              })}
            </View>

            {noDate.length > 0 ? (
              <View className="gap-2">
                <SectionHead title="Needs a due date" />
                {noDate.map((a) => (
                  <Pressable
                    key={a.id}
                    accessibilityRole="button"
                    onPress={() => openEdit(a)}
                    className="bg-card border-border flex-row items-center justify-between gap-3 rounded-xl border px-3.5 py-3 active:bg-accent">
                    <Text className="flex-1 font-semibold text-base">{a.name}</Text>
                    <Badge warn>Add date</Badge>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {finished.length > 0 ? (
              <View className="gap-2">
                <SectionHead title="Done or past" />
                {finished.map((a) => (
                  <Pressable
                    key={a.id}
                    accessibilityRole="button"
                    onPress={() => openEdit(a)}
                    className="bg-card border-border flex-row items-center justify-between gap-3 rounded-xl border px-3.5 py-3 active:bg-accent">
                    <Text className="text-muted-foreground flex-1 text-base">{a.name}</Text>
                    <Text className="text-muted-foreground text-xs">
                      {a.weight}% · {a.status === 'done' ? 'Done' : 'Past due'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
          <View className={cn('gap-5', wide && 'min-w-0 flex-1')}>
            <TopicList course={course} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BackButton() {
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/courses'))}
      className="min-h-11 justify-center rounded-full pr-3 active:opacity-70"
      accessibilityRole="button">
      <Text className="text-primary text-base font-semibold">‹ Courses</Text>
    </Pressable>
  );
}

function QuickButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={cn(
        'min-h-9 items-center justify-center rounded-full border px-3.5',
        primary ? 'bg-primary border-primary active:opacity-80' : 'border-border active:bg-accent',
      )}>
      <Text className={cn('text-[13px] font-semibold', primary ? 'text-primary-foreground' : 'text-foreground')}>{label}</Text>
    </Pressable>
  );
}

function Badge({ children, warn }: { children: string; warn?: boolean }) {
  return (
    <View className={cn('rounded-md px-1.5 py-0.5', warn ? 'bg-[#2E2210]' : 'border border-border')}>
      <Text className={cn('text-xs font-semibold', warn ? 'text-[#FFB547]' : 'text-[#C9CCD3]')}>{children}</Text>
    </View>
  );
}
