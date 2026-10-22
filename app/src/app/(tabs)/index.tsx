import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CompletedToday } from '@/components/completed-today';
import { Ring, SectionHead, StatCard, WeekStrip, flow } from '@/components/dashboard';
import { ProgressBar, StudyTimer } from '@/components/study-timer';
import { TrajectoryView } from '@/components/trajectory-view';
import { Text } from '@/components/ui/text';
import { T, WIDE } from '@/constants/trajectory';
import type { Assessment, Course, Status } from '@/data/courses';
import { useSmartPlan } from '@/lib/ai-plan';
import { countdown, daysUntil, dueLabel, hoursLabel, shortCountdown, todayHours, todaysPlan, upcoming, urgencyBarColor, urgencyColor, whyLabel } from '@/lib/planning';
import { useDailyHours } from '@/lib/daily-hours';
import { dayKey } from '@/lib/day';
import { useHolidays } from '@/lib/holidays';
import { useStore } from '@/lib/store';
import { minutesLabel, useStudySession } from '@/lib/study-session';
import { cn } from '@/lib/utils';

const HOUR_MS = 3_600_000;

export default function TodayScreen() {
  const study = useStudySession();
  const { now } = study;
  const { courses, setStatus, online } = useStore();
  const [hoursAvailable] = useDailyHours();
  const holidays = useHolidays(now);
  const holidayToday = holidays.get(dayKey(now));
  const wide = useWindowDimensions().width >= WIDE;
  // A course page's "Start timer" lands here with the assessment to start.
  const { start } = useLocalSearchParams<{ start?: string }>();
  // Sonnet's plan when there is one; the on-device plan otherwise.
  const smart = useSmartPlan(courses, hoursAvailable, holidayToday ?? null, online, dayKey(now));
  const smartItems = smart.items?.length ? smart.items : null;
  const smartFor = new Map(smartItems?.map((s) => [s.assessment.id, s]));
  const plan = smartItems ?? todaysPlan(courses, now, hoursAvailable);
  const hoursToday = (a: Assessment, course: Course) => {
    const block = smartFor.get(a.id);
    return block ? block.minutes / 60 : todayHours(a, course);
  };
  const plannedHours = plan.reduce((sum, p) => sum + hoursToday(p.assessment, p.course), 0);
  const dateLabel = new Date(now).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Australia/Brisbane',
  });
  const examDates = courses
    .flatMap((c) => c.assessments)
    .filter((a) => a.isExam && a.due && daysUntil(a.due, now) > 0)
    .map((a) => daysUntil(a.due, now));
  const examDays = examDates.length ? Math.ceil(Math.min(...examDates)) : null;

  // An item is finished for today once its timer reaches today's slot.
  const all = courses.flatMap((course) =>
    course.assessments.map((assessment) => {
      const studied = study.studiedMs(assessment.id);
      const target = hoursToday(assessment, course) * HOUR_MS;
      return {
        course,
        assessment,
        studied,
        target,
        finished: studied > 0 && studied >= target,
      };
    }),
  );
  const todo = plan.flatMap((p) => all.filter((x) => x.assessment.id === p.assessment.id && !x.finished));
  const completed = all.filter((x) => x.finished);
  // Look the active item up across all courses: it may have dropped off today's plan.
  const active = all.find((x) => x.assessment.id === study.activeId && x.assessment.status !== 'done');

  // Hitting the goal stops the clock and moves the item to "Completed today".
  const activeFinished = !!active?.finished && study.mode === 'study';
  const { finish } = study;
  useEffect(() => {
    if (activeFinished) finish();
  }, [activeFinished, finish]);

  const startOn = (id: string, status: Status) => {
    study.focus(id);
    if (status === 'not_started') setStatus(id, 'in_progress');
  };
  const next = todo[0];
  const empty = emptyState(courses);

  const startTarget = start ? all.find((x) => x.assessment.id === start) : undefined;
  useEffect(() => {
    if (!start) return;
    if (startTarget) startOn(startTarget.assessment.id, startTarget.assessment.status);
    router.replace('/'); // drop the param so a reload doesn't start it again
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per request
  }, [start]);

  const plannedMs = plannedHours * HOUR_MS;
  const dayProgress = plannedMs > 0 ? study.totalStudiedMs / plannedMs : 0;
  const soonest = upcoming(courses, now)[0];
  const doneCount = plan.length - todo.length;

  const timer = (
    <Animated.View entering={FadeInDown.duration(400)}>
      <StudyTimer
        mode={active ? study.mode : 'idle'}
        current={
          active
            ? {
                label: `${active.course.code} · ${active.assessment.name}`,
                studiedMs: active.studied,
                targetMs: active.target,
              }
            : null
        }
        breakMs={study.breakMs}
        totalStudiedMs={study.totalStudiedMs}
        plannedMs={plannedMs}
        doneCount={doneCount}
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

  const planList = (
    <View className="gap-3">
      <SectionHead title="Today's plan">
        {online && smart.replansLeft > 0 && (plan.length > 0 || smart.message) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Re-plan today, ${smart.replansLeft} left`}
            disabled={smart.busy}
            onPress={smart.replan}
            className={cn('min-h-10 justify-center rounded-full border border-border px-4 active:bg-accent', smart.busy && 'opacity-60')}>
            <Text className="text-primary text-sm font-semibold">{smart.busy ? 'Planning…' : `↻ Re-plan (${smart.replansLeft})`}</Text>
          </Pressable>
        ) : null}
      </SectionHead>
      {plan.length > 0 || smart.message ? (
        <View className="flex-row items-center gap-2 px-1">
          <View className={cn('h-2 w-2 rounded-full', smartItems ? 'bg-primary' : 'bg-muted-foreground')} />
          <Text className="text-muted-foreground flex-1 text-[13px]">
            {smartItems ? 'Smart plan from your deadlines and notes.' : smart.loading ? 'Making your smart plan…' : (smart.message ?? 'Showing your usual plan.')}
          </Text>
        </View>
      ) : null}

      {todo.length === 0 && completed.length === 0 ? (
        <Animated.View entering={FadeInDown.delay(80)}>
          <View className="bg-card border-border gap-1 rounded-2xl border p-5">
            <Text className="font-bold text-lg">{empty.title}</Text>
            <Text className="text-muted-foreground text-sm">{empty.text}</Text>
          </View>
        </Animated.View>
      ) : null}

      {todo.map(({ course, assessment, studied, target }, i) => {
        const isActive = active?.assessment.id === assessment.id;
        const block = smartFor.get(assessment.id);
        return (
          <Animated.View
            key={assessment.id}
            entering={FadeInDown.delay(80 + i * 70)
              .springify()
              .damping(18)}
            exiting={FadeOut.duration(200)}
            layout={flow}>
            <PlanCard
              course={course}
              assessment={assessment}
              studied={studied}
              target={target}
              hours={hoursToday(assessment, course)}
              now={now}
              first={i === 0}
              mode={isActive ? study.mode : 'idle'}
              reason={block ? block.reason || whyLabel(assessment, now) : i === 0 ? (assessment.why ?? whyLabel(assessment, now)) : null}
              topics={block?.topics ?? []}
              onTimer={() => (!isActive ? startOn(assessment.id, assessment.status) : study.mode === 'break' ? study.resume() : study.takeBreak())}
            />
          </Animated.View>
        );
      })}

      {completed.length > 0 ? (
        <Animated.View layout={flow}>
          <CompletedToday
            items={completed.map((c) => ({
              id: c.assessment.id,
              name: c.assessment.name,
              code: c.course.code,
              studied: c.studied,
            }))}
          />
        </Animated.View>
      ) : null}
    </View>
  );

  const trajectory = (
    <Animated.View entering={FadeInDown.delay(160).duration(500)}>
      <TrajectoryView courses={courses} now={now} />
    </Animated.View>
  );

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView contentContainerClassName={cn('w-full self-center gap-5 px-4 pb-10 pt-3', wide ? 'max-w-[1400px] px-10 pt-7' : 'max-w-[720px]')}>
        <View className="flex-row items-end justify-between gap-3 px-1">
          <View className="flex-1 gap-0.5">
            <Text className="text-muted-foreground text-sm">
              {dateLabel}
              {holidayToday ? <Text className="text-primary text-sm font-semibold"> · Public holiday: {holidayToday}</Text> : null}
            </Text>
            <Text className="font-display text-4xl tracking-tighter">{greeting(now)}</Text>
          </View>
          {examDays !== null ? (
            <View className="bg-card border-border rounded-full border px-3 py-1.5">
              <Text className="text-muted-foreground font-mono text-xs">exams in {examDays}d</Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row flex-wrap gap-3">
          <StatCard index={0} label="Studied today" value={minutesLabel(study.totalStudiedMs)} hint={`of ${minutesLabel(plannedMs)} planned`}>
            <Ring value={dayProgress} size={52}>
              <Text className="font-mono text-[11px]">{Math.min(100, Math.round(dayProgress * 100))}%</Text>
            </Ring>
          </StatCard>
          <StatCard index={1} label="Plan" value={`${doneCount}/${plan.length}`} hint={plan.length ? 'blocks done' : 'nothing planned'} />
          <StatCard
            index={2}
            label="Next deadline"
            value={soonest ? shortCountdown(soonest.assessment.due, now) : '—'}
            tone={soonest ? urgencyColor(daysUntil(soonest.assessment.due, now)) : T.muted}
            hint={soonest ? `${soonest.course.code} · ${soonest.assessment.name}` : 'all clear'}
          />
          <StatCard index={3} label="Exams" value={examDays !== null ? `${examDays}d` : '—'} hint={examDays !== null ? 'until the first one' : 'none scheduled'} />
        </View>

        {wide ? (
          <View className="flex-row items-start gap-5">
            <View className="min-w-0 flex-1 gap-5">
              {timer}
              <ComingUp courses={courses} now={now} holidays={holidays} />
            </View>
            <View className="min-w-0 flex-[1.2] gap-5">
              {planList}
              {trajectory}
            </View>
          </View>
        ) : (
          <View className="gap-5">
            {timer}
            {planList}
            <ComingUp courses={courses} now={now} holidays={holidays} />
            {trajectory}
          </View>
        )}
        <Text className="text-muted-foreground text-center text-[13px]">Only study time counts towards today. Breaks pause the clock.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/** One block of today's plan; "Why this?" opens and closes on tap. */
function PlanCard(p: {
  course: Course;
  assessment: Assessment;
  studied: number;
  target: number;
  hours: number;
  now: number;
  first: boolean;
  mode: 'idle' | 'study' | 'break';
  reason: string | null;
  topics: string[];
  onTimer: () => void;
}) {
  const [open, setOpen] = useState(p.first);
  const days = daysUntil(p.assessment.due, p.now);
  const status = statusHeading(p.mode, p.studied, p.target);
  const isActive = p.mode !== 'idle';
  const primary = p.first || isActive;
  return (
    <View className={cn('bg-card flex-row overflow-hidden rounded-2xl border', isActive ? 'border-primary border-2' : p.first ? 'border-input' : 'border-border')}>
      <View style={{ width: 4, backgroundColor: urgencyBarColor(days) }} />
      <View className="flex-1 gap-2 p-4">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="font-semibold text-[13px]" style={{ color: status.color }}>
            {status.text}
          </Text>
          <Text className="font-mono text-lg" style={{ color: urgencyColor(days) }}>
            {countdown(p.assessment.due, p.now)}
          </Text>
        </View>
        <Text className="font-bold text-lg leading-6 tracking-tight">{p.assessment.name}</Text>
        <View className="flex-row flex-wrap gap-1.5">
          <Tag>{p.course.code}</Tag>
          <Tag>{hoursLabel(p.hours).replace('~', '')} today</Tag>
          <Tag>{p.assessment.weight}% of grade</Tag>
        </View>
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <ProgressBar value={p.target ? p.studied / p.target : 0} color={T.accent} track={T.neutralSoft} height={6} />
          </View>
          <Text className="text-muted-foreground font-mono text-xs">
            {minutesLabel(p.studied)} / {minutesLabel(p.target)}
          </Text>
        </View>

        {p.reason ? (
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((o) => !o)} className="bg-background rounded-xl px-3 py-2.5 active:opacity-80">
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold text-[13px]">Why this?</Text>
              <Text className="text-muted-foreground text-xs">{open ? 'Hide' : 'Show'}</Text>
            </View>
            {open ? (
              <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 4, gap: 4 }}>
                <Text className="text-[13px] leading-5 text-[#C9CCD3]">{p.reason}</Text>
                {p.topics.length ? (
                  <View className="flex-row flex-wrap gap-1.5 pt-1">
                    {p.topics.map((t) => (
                      <View key={t} className="bg-[#1F2610] rounded-full px-2.5 py-1">
                        <Text className="text-xs font-semibold text-[#D8FF6A]">{t}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Animated.View>
            ) : null}
          </Pressable>
        ) : null}

        <View className="flex-row gap-2 pt-1">
          <Pressable
            accessibilityRole="button"
            onPress={p.onTimer}
            className={cn('h-11 flex-1 items-center justify-center rounded-full', primary ? 'bg-primary active:opacity-80' : 'border-border border bg-card active:bg-accent')}>
            <Text className={cn('text-[15px] font-semibold', primary ? 'text-primary-foreground' : 'text-foreground')}>
              {isActive ? (p.mode === 'break' ? 'Back to it' : 'Take a break') : p.studied > 0 ? 'Resume timer' : 'Start timer'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${p.course.code}`}
            onPress={() => router.push({ pathname: '/course/[code]', params: { code: p.course.code } })}
            className="border-border bg-card h-11 items-center justify-center rounded-full border px-4 active:bg-accent">
            <Text className="text-[15px] font-medium">Course</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-secondary rounded-md px-2 py-0.5">
      <Text className="text-xs font-semibold text-[#C9CCD3]">{children}</Text>
    </View>
  );
}

/** The week ahead with every upcoming deadline; tap a day to see only what's due then. */
function ComingUp({ courses, now, holidays }: { courses: Course[]; now: number; holidays: Map<string, string> }) {
  const [day, setDay] = useState<string | null>(null);
  const all = upcoming(courses, now);
  if (all.length === 0) return null;
  const counts = new Map<string, number>();
  for (const { assessment } of all) {
    const key = dayKey(new Date(assessment.due!).getTime());
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const shown = day ? all.filter((x) => dayKey(new Date(x.assessment.due!).getTime()) === day) : all.slice(0, 5);
  return (
    <Animated.View entering={FadeInDown.delay(120).duration(500)}>
      <View className="bg-card border-border gap-3 rounded-2xl border p-4">
        <SectionHead title="Coming up">
          {day ? (
            <Pressable accessibilityRole="button" onPress={() => setDay(null)} className="min-h-10 justify-center px-1">
              <Text className="text-primary text-sm font-semibold">Show all</Text>
            </Pressable>
          ) : null}
        </SectionHead>
        <WeekStrip now={now} counts={counts} selected={day} onSelect={setDay} />
        <Animated.View layout={flow} style={{ gap: 4 }}>
          {shown.length === 0 ? <Text className="text-muted-foreground px-1 py-3 text-sm">Nothing due that day.</Text> : null}
          {shown.map(({ course, assessment }) => (
            <Animated.View key={assessment.id} entering={FadeIn.duration(220)} layout={flow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/course/[code]', params: { code: course.code } })}
                className="min-h-[52px] flex-row items-center gap-3 rounded-xl px-2 py-2 active:bg-accent">
                <View className="h-9 w-1 rounded-full" style={{ backgroundColor: urgencyBarColor(daysUntil(assessment.due, now)) }} />
                <View className="flex-1 gap-0.5">
                  <Text className="font-semibold text-[15px]" numberOfLines={1}>
                    {assessment.name}
                  </Text>
                  <Text className="text-muted-foreground text-[13px]">
                    {course.code} · {dueLabel(assessment.due)}
                    {holidays.has(dayKey(new Date(assessment.due!).getTime())) ? <Text className="text-primary text-[13px]"> · Public holiday</Text> : null}
                  </Text>
                </View>
                <Text className="font-mono text-[15px]" style={{ color: urgencyColor(daysUntil(assessment.due, now)) }}>
                  {shortCountdown(assessment.due, now)}
                </Text>
              </Pressable>
            </Animated.View>
          ))}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

/** "Good morning" and friends, by the hour in Brisbane. */
function greeting(now: number): string {
  const hour = Number(new Date(now).toLocaleString('en-AU', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Australia/Brisbane' }));
  if (hour < 5) return 'Late night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** What Today says when there's nothing to plan, depending on why. */
function emptyState(courses: Course[]): { title: string; text: string } {
  if (!courses.length) return { title: 'No courses yet', text: 'Add your courses from the Courses tab to get a plan.' };
  if (!courses.some((c) => c.assessments.length)) {
    return { title: 'No assessments yet', text: 'Add assessments from a course page and they will show up here.' };
  }
  return { title: 'Nothing due right now', text: 'Everything with a due date is done. Nice work.' };
}

/** The heading on each card, from today's progress alone. */
function statusHeading(mode: 'idle' | 'study' | 'break', studied: number, target: number): { text: string; color: string } {
  if (mode === 'study') return { text: '● Studying now', color: T.accent };
  if (mode === 'break') return { text: 'On a break', color: T.warn };
  if (studied > 0)
    return {
      text: `In progress · ${Math.floor((studied / target) * 100)}%`,
      color: T.accent,
    };
  return { text: 'Not started', color: T.muted };
}
