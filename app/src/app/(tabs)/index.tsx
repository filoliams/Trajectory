import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CompletedToday } from '@/components/completed-today';
import { HeroProgress, SectionHead, StatCard, StreakCard, WeekChart, WeekStrip, flow } from '@/components/dashboard';
import { QuizSheet } from '@/components/quiz-sheet';
import { ProgressBar } from '@/components/study-timer';
import { TrajectoryView } from '@/components/trajectory-view';
import { Text } from '@/components/ui/text';
import { T, WIDE } from '@/constants/trajectory';
import type { Assessment, Course, Status, Topic } from '@/data/courses';
import { confidenceNote } from '@/lib/confidence';
import { courseColor } from '@/lib/course-colors';
import { countdown, daysUntil, dueLabel, hoursLabel, shortCountdown, upcoming, urgencyColor, whyLabel } from '@/lib/planning';
import { dayKey } from '@/lib/day';
import { useStore } from '@/lib/store';
import { useStudyHistory } from '@/lib/study-history';
import { clock, minutesLabel } from '@/lib/study-session';
import { useToday } from '@/lib/today';
import { cn } from '@/lib/utils';

export default function TodayScreen() {
  const { study, now, holidays, holidayToday, smart, smartFor, plan, hoursToday, plannedMs, todo, completed, active, next, startOn } = useToday();
  const { courses, online } = useStore();
  const width = useWindowDimensions().width;
  const wide = width >= WIDE;
  // Big desktop windows get a third column for the week ahead.
  const threeCols = width >= 1360;
  const codes = courses.map((c) => c.code);
  const colorOf = (code: string) => courseColor(code, codes);
  const smartItems = smart.items?.length ? smart.items : null;
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

  const empty = emptyState(courses);
  const [quizTopic, setQuizTopic] = useState<Topic | null>(null);
  const history = useStudyHistory(dayKey(now), study.totalStudiedMs);
  const soonest = upcoming(courses, now)[0];
  const doneCount = plan.length - todo.length;
  /** Start the clock on an item and go to the Study tab, where the timer lives. */
  const studyOn = (id: string, status: Status) => {
    startOn(id, status);
    router.navigate('/study');
  };

  // While the clock runs, a slim live bar links back to the timer.
  const nowStudying =
    active && study.mode !== 'idle' ? (
      <Animated.View entering={FadeInDown.duration(300)} exiting={FadeOut.duration(200)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open the study timer"
          onPress={() => router.navigate('/study')}
          className="bg-card flex-row items-center gap-3 rounded-2xl border border-primary px-4 py-3 active:opacity-80">
          <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: study.mode === 'break' ? T.warn : T.accent }} />
          <View className="flex-1">
            <Text className="text-muted-foreground text-xs">{study.mode === 'break' ? 'On a break' : 'Studying now'}</Text>
            <Text className="font-semibold text-[15px]" numberOfLines={1}>
              {active.course.code} · {active.assessment.name}
            </Text>
          </View>
          <Text className="font-mono text-xl" style={{ color: study.mode === 'break' ? T.warn : T.accent }}>
            {clock(study.mode === 'break' ? study.breakMs : active.studied)}
          </Text>
          <Text className="text-muted-foreground text-lg">›</Text>
        </Pressable>
      </Animated.View>
    ) : null;

  const planList = (
    <View className="gap-3">
      <SectionHead title="Today's plan">
        {wide && online && smart.replansLeft > 0 && (plan.length > 0 || smart.message) ? (
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
        const base = block ? block.reason || whyLabel(assessment, now) : i === 0 ? (assessment.why ?? whyLabel(assessment, now)) : null;
        // The first card also says what moved this week and which topic is shakiest, with a quiz on it.
        const note = i === 0 ? confidenceNote(course.topics, now) : null;
        const shakiest = note?.shakiest ?? null;
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
              color={colorOf(course.code)}
              mode={isActive ? study.mode : 'idle'}
              reason={note && base ? `${base} ${note.text}` : base}
              topics={block?.topics ?? []}
              onQuiz={shakiest && online ? () => setQuizTopic(shakiest) : undefined}
              onTimer={() => (!isActive ? studyOn(assessment.id, assessment.status) : study.mode === 'break' ? study.resume() : study.takeBreak())}
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
      <ScrollView contentContainerClassName={cn('w-full self-center gap-5 px-4 pb-10 pt-3', wide ? 'max-w-[1600px] px-10 pt-7' : 'max-w-[720px]')}>
        <View className="gap-1 px-1">
          <Text className="text-muted-foreground text-sm">
            {dateLabel}
            {holidayToday ? <Text className="text-primary text-sm font-semibold"> · Public holiday: {holidayToday}</Text> : null}
          </Text>
          <Text className="font-display text-[44px] leading-[48px] tracking-tighter">
            {greeting(now)[0]} <Text className="font-serif text-[48px] text-primary">{greeting(now)[1]}</Text>
          </Text>
        </View>

        {!wide ? (
          <View className="flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              disabled={!next && !active}
              onPress={() => (active ? router.navigate('/study') : next && studyOn(next.assessment.id, next.assessment.status))}
              className={cn('h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-primary active:opacity-80', !next && !active && 'opacity-40')}>
              <Text className="text-primary-foreground text-base">▶</Text>
              <Text className="text-primary-foreground text-[15px] font-semibold">{active ? 'Open timer' : 'Study now'}</Text>
            </Pressable>
            {online && smart.replansLeft > 0 && plan.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Re-plan today, ${smart.replansLeft} left`}
                disabled={smart.busy}
                onPress={smart.replan}
                className={cn('bg-card border-border h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full border active:bg-accent', smart.busy && 'opacity-60')}>
                <Text className="text-primary text-base">↻</Text>
                <Text className="text-[15px] font-semibold">{smart.busy ? 'Planning…' : 'Re-plan'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View className="flex-row flex-wrap gap-3">
          <HeroProgress studiedMs={study.totalStudiedMs} plannedMs={plannedMs} done={doneCount} total={plan.length} />
          <WeekChart days={history.days} msByDay={history.msByDay} />
          <StreakCard days={history.days} msByDay={history.msByDay} />
          <View className="gap-3" style={{ flexGrow: 1, flexBasis: 200 }}>
            <StatCard
              index={3}
              label="Next deadline"
              value={soonest ? shortCountdown(soonest.assessment.due, now) : '—'}
              tone={soonest ? urgencyColor(daysUntil(soonest.assessment.due, now)) : T.muted}
              hint={soonest ? `${soonest.course.code} · ${soonest.assessment.name}` : 'all clear'}
            />
            <StatCard index={4} label="Exams" value={examDays !== null ? `${examDays}d` : '—'} hint={examDays !== null ? 'until the first one' : 'none scheduled'} />
          </View>
        </View>

        {nowStudying}

        <NoTopicsNudge courses={courses} />

        {threeCols ? (
          <View className="flex-row items-start gap-5">
            <View className="min-w-0 flex-[1.2] gap-5">{planList}</View>
            <View className="min-w-0 flex-1 gap-5">
              <ComingUp courses={courses} now={now} holidays={holidays} colorOf={colorOf} />
            </View>
            <View className="min-w-0 flex-1 gap-5">{trajectory}</View>
          </View>
        ) : wide ? (
          <View className="flex-row items-start gap-5">
            <View className="min-w-0 flex-[1.2] gap-5">{planList}</View>
            <View className="min-w-0 flex-1 gap-5">
              <ComingUp courses={courses} now={now} holidays={holidays} colorOf={colorOf} />
              {trajectory}
            </View>
          </View>
        ) : (
          <View className="gap-5">
            {planList}
            <ComingUp courses={courses} now={now} holidays={holidays} colorOf={colorOf} />
            {trajectory}
          </View>
        )}
        <Text className="text-muted-foreground text-center text-[13px]">Only study time counts towards today. Breaks pause the clock.</Text>
      </ScrollView>
      {quizTopic ? <QuizSheet topic={quizTopic} onClose={() => setQuizTopic(null)} /> : null}
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
  /** The course's colour, on the card's edge and its code tag. */
  color: string;
  mode: 'idle' | 'study' | 'break';
  reason: string | null;
  topics: string[];
  onTimer: () => void;
  /** Quiz on the course's shakiest topic; only on the first card. */
  onQuiz?: () => void;
}) {
  const [open, setOpen] = useState(p.first);
  const days = daysUntil(p.assessment.due, p.now);
  const status = statusHeading(p.mode, p.studied, p.target);
  const isActive = p.mode !== 'idle';
  const primary = p.first || isActive;
  return (
    <View className={cn('bg-card flex-row overflow-hidden rounded-2xl border', isActive ? 'border-primary border-2' : p.first ? 'border-input' : 'border-border')}>
      <View style={{ width: 4, backgroundColor: p.color }} />
      <View className="flex-1 gap-2 p-4">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="font-semibold text-[13px]" style={{ color: status.color }}>
            {status.text}
          </Text>
          <Text className="font-mono text-lg" style={{ color: urgencyColor(days) }}>
            {countdown(p.assessment.due, p.now)}
          </Text>
        </View>
        <Text className="font-heading text-xl leading-6 tracking-tight">{p.assessment.name}</Text>
        <View className="flex-row flex-wrap gap-1.5">
          <View className="flex-row items-center gap-1.5 rounded-md px-2 py-0.5" style={{ backgroundColor: `${p.color}22` }}>
            <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
            <Text className="text-xs font-semibold" style={{ color: p.color }}>
              {p.course.code}
            </Text>
          </View>
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
          {p.onQuiz ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quiz me on the shakiest topic"
              onPress={p.onQuiz}
              className="border-border bg-card h-11 items-center justify-center rounded-full border px-4 active:bg-accent">
              <Text className="text-[15px] font-medium">Quiz me</Text>
            </Pressable>
          ) : null}
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
function ComingUp({
  courses,
  now,
  holidays,
  colorOf,
}: {
  courses: Course[];
  now: number;
  holidays: Map<string, string>;
  colorOf: (code: string) => string;
}) {
  const [day, setDay] = useState<string | null>(null);
  const all = upcoming(courses, now);
  if (all.length === 0) return null;
  const dots = new Map<string, string[]>();
  for (const { course, assessment } of all) {
    const key = dayKey(new Date(assessment.due!).getTime());
    dots.set(key, [...(dots.get(key) ?? []), colorOf(course.code)]);
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
        <WeekStrip now={now} dots={dots} selected={day} onSelect={setDay} />
        <Animated.View layout={flow} style={{ gap: 4 }}>
          {shown.length === 0 ? <Text className="text-muted-foreground px-1 py-3 text-sm">Nothing due that day.</Text> : null}
          {shown.map(({ course, assessment }) => (
            <Animated.View key={assessment.id} entering={FadeIn.duration(220)} layout={flow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/course/[code]', params: { code: course.code } })}
                className="min-h-[52px] flex-row items-center gap-3 rounded-xl px-2 py-2 active:bg-accent">
                <View className="h-9 w-1 rounded-full" style={{ backgroundColor: colorOf(course.code) }} />
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

/** Notes are checked against a course's topics, so a course without any gets a nudge with a shortcut to add them. */
function NoTopicsNudge({ courses }: { courses: Course[] }) {
  const bare = courses.filter((c) => c.topics.length === 0).map((c) => c.code);
  if (!bare.length) return null;
  const names = bare.length === 1 ? bare[0] : `${bare.slice(0, -1).join(', ')} and ${bare[bare.length - 1]}`;
  return (
    <View className="bg-card flex-row flex-wrap items-center gap-3 rounded-2xl border border-dashed border-[#3A3D46] px-4 py-3.5">
      <Text className="min-w-[200px] flex-1 text-[13.5px] leading-5 text-[#C9CCD3]">
        <Text className="font-semibold text-[13.5px]">{names}</Text> {bare.length === 1 ? 'has' : 'have'} no topics yet, so notes can’t be checked
        against {bare.length === 1 ? 'it' : 'them'}.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add topics to ${bare[0]}`}
        onPress={() => router.push({ pathname: '/course/[code]', params: { code: bare[0] } })}
        className="border-border bg-card min-h-10 justify-center rounded-full border px-4 active:bg-accent">
        <Text className="text-primary text-sm font-semibold">Add topics</Text>
      </Pressable>
    </View>
  );
}

/** "Good" + "morning" and friends, by the hour in Brisbane; the second word is set in the serif. */
function greeting(now: number): [string, string] {
  const hour = Number(new Date(now).toLocaleString('en-AU', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Australia/Brisbane' }));
  if (hour < 5) return ['Late', 'night'];
  if (hour < 12) return ['Good', 'morning'];
  if (hour < 18) return ['Good', 'afternoon'];
  return ['Good', 'evening'];
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
