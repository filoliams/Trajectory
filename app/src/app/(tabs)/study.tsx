import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CompletedToday } from '@/components/completed-today';
import { SectionHead, flow } from '@/components/dashboard';
import { ProgressBar, StudyTimer } from '@/components/study-timer';
import { Text } from '@/components/ui/text';
import { T, WIDE } from '@/constants/trajectory';
import { courseColor } from '@/lib/course-colors';
import { useStore } from '@/lib/store';
import { minutesLabel } from '@/lib/study-session';
import { useToday } from '@/lib/today';
import { cn } from '@/lib/utils';

export default function StudyScreen() {
  const { courses } = useStore();
  const { study, plan, plannedMs, all, todo, completed, active, next, startOn } = useToday();
  const wide = useWindowDimensions().width >= WIDE;
  const codes = courses.map((c) => c.code);

  // A course page's "Start timer" lands here with the assessment to start.
  const { start } = useLocalSearchParams<{ start?: string }>();
  const startTarget = start ? all.find((x) => x.assessment.id === start) : undefined;
  useEffect(() => {
    if (!start) return;
    if (startTarget) startOn(startTarget.assessment.id, startTarget.assessment.status);
    router.replace('/study'); // drop the param so a reload doesn't start it again
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per request
  }, [start]);

  const timer = (
    <Animated.View entering={FadeInDown.duration(400)}>
      <StudyTimer
        mode={active ? study.mode : 'idle'}
        current={active ? { label: `${active.course.code} · ${active.assessment.name}`, studiedMs: active.studied, targetMs: active.target } : null}
        breakMs={study.breakMs}
        totalStudiedMs={study.totalStudiedMs}
        plannedMs={plannedMs}
        doneCount={plan.length - todo.length}
        planCount={plan.length}
        celebrating={study.cheering}
        companion={study.companion}
        onCompanion={study.setCompanion}
        onStart={next ? () => startOn(next.assessment.id, next.assessment.status) : undefined}
        onBreak={study.takeBreak}
        onResume={study.resume}
        onStop={study.stop}
      />
    </Animated.View>
  );

  const queue = (
    <View className="gap-3">
      <SectionHead title="Up next" />
      {todo.length === 0 ? (
        <View className="bg-card border-border rounded-2xl border p-5">
          <Text className="text-muted-foreground text-sm">{plan.length ? 'Everything planned for today is done.' : 'Nothing planned for today.'}</Text>
        </View>
      ) : null}
      {todo.map(({ course, assessment, studied, target }, i) => {
        const isActive = active?.assessment.id === assessment.id;
        const color = courseColor(course.code, codes);
        return (
          <Animated.View
            key={assessment.id}
            entering={FadeInDown.delay(60 + i * 60)
              .springify()
              .damping(18)}
            exiting={FadeOut.duration(200)}
            layout={flow}>
            <View className={cn('bg-card flex-row items-center gap-3 overflow-hidden rounded-2xl border p-3 pl-0', isActive ? 'border-primary' : 'border-border')}>
              <View className="w-1 self-stretch" style={{ backgroundColor: color }} />
              <View className="flex-1 gap-1.5">
                <Text className="font-semibold text-[15px]" numberOfLines={1}>
                  {assessment.name}
                </Text>
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs font-semibold" style={{ color }}>
                    {course.code}
                  </Text>
                  <Text className="text-muted-foreground font-mono text-xs">
                    {minutesLabel(studied)} / {minutesLabel(target)}
                  </Text>
                </View>
                <ProgressBar value={target ? studied / target : 0} color={color} track={T.neutralSoft} height={4} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${isActive ? (study.mode === 'break' ? 'Resume' : 'Pause') : 'Start'} ${assessment.name}`}
                onPress={() => (!isActive ? startOn(assessment.id, assessment.status) : study.mode === 'break' ? study.resume() : study.takeBreak())}
                className={cn(
                  'h-10 min-w-[84px] items-center justify-center rounded-full px-3',
                  isActive ? 'border-border bg-background border active:bg-accent' : 'bg-primary active:opacity-80',
                )}>
                <Text className={cn('text-sm font-semibold', isActive ? 'text-foreground' : 'text-primary-foreground')}>
                  {isActive ? (study.mode === 'break' ? 'Resume' : 'Pause') : studied > 0 ? 'Resume' : 'Start'}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        );
      })}
      {completed.length > 0 ? (
        <Animated.View layout={flow}>
          <CompletedToday items={completed.map((c) => ({ id: c.assessment.id, name: c.assessment.name, code: c.course.code, studied: c.studied }))} />
        </Animated.View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView contentContainerClassName={cn('w-full self-center gap-5 px-4 pb-10 pt-3', wide ? 'max-w-[1200px] px-10 pt-7' : 'max-w-[720px]')}>
        <View className="gap-1 px-1">
          <Text className="text-muted-foreground text-sm">
            {minutesLabel(study.totalStudiedMs)} of {minutesLabel(plannedMs)} planned today
          </Text>
          <Text className="font-display text-[44px] leading-[48px] tracking-tighter">
            Focus <Text className="font-serif text-[48px] text-primary">mode</Text>
          </Text>
        </View>
        {wide ? (
          <View className="flex-row items-start gap-6">
            <View className="min-w-0 flex-[1.3]">{timer}</View>
            <View className="min-w-0 flex-1">{queue}</View>
          </View>
        ) : (
          <View className="gap-5">
            {timer}
            {queue}
          </View>
        )}
        <Text className="text-muted-foreground text-center text-[13px]">Only study time counts towards today. Breaks pause the clock.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
