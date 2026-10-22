import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CompletedToday } from '@/components/completed-today';
import { ProgressBar, StudyTimer } from '@/components/study-timer';
import { TrajectoryView } from '@/components/trajectory-view';
import { T, WIDE, font, mono, monoBold, radius, typo } from '@/constants/trajectory';
import type { Assessment, Course, Status } from '@/data/courses';
import { useSmartPlan } from '@/lib/ai-plan';
import { countdown, daysUntil, dueLabel, hoursLabel, shortCountdown, todayHours, todaysPlan, upcoming, urgencyColor, whyLabel } from '@/lib/planning';
import { useDailyHours } from '@/lib/daily-hours';
import { dayKey } from '@/lib/day';
import { useHolidays } from '@/lib/holidays';
import { useStore } from '@/lib/store';
import { minutesLabel, useStudySession } from '@/lib/study-session';

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

  const trajectory = (
    <Animated.View entering={FadeInDown.delay(160).duration(500)}>
      <TrajectoryView courses={courses} now={now} />
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, wide && styles.contentWide]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.date}>
              {dateLabel}
              {holidayToday ? <Text style={styles.holiday}> · Public holiday: {holidayToday}</Text> : null}
            </Text>
            <Text style={styles.title}>Today</Text>
          </View>
          {examDays !== null ? <Text style={styles.examPill}>exams in {examDays}d</Text> : null}
        </View>

        <View style={wide ? styles.columns : styles.stack}>
          <View style={wide ? styles.colWide : styles.stack}>
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
                plannedMs={plannedHours * HOUR_MS}
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
            {wide ? <ComingUp courses={courses} now={now} holidays={holidays} /> : null}
          </View>

          <View style={wide ? styles.colWide : styles.stack}>
            {wide ? trajectory : null}
            {plan.length > 0 || smart.message ? (
              <View style={styles.planBar}>
                <Text style={styles.planBarText}>
                  {smartItems
                    ? 'Smart plan from your deadlines and notes.'
                    : smart.loading
                      ? 'Making your smart plan…'
                      : (smart.message ?? 'Showing your usual plan.')}
                </Text>
                {online && smart.replansLeft > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Re-plan today, ${smart.replansLeft} left`}
                    disabled={smart.busy}
                    onPress={smart.replan}
                    style={({ pressed }) => [styles.replanBtn, (pressed || smart.busy) && styles.pressed]}>
                    <Text style={styles.replanText}>{smart.busy ? 'Planning…' : `Re-plan (${smart.replansLeft})`}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {todo.length === 0 && completed.length === 0 ? (
              <Animated.View entering={FadeInDown.delay(80)} style={styles.task}>
                <Text style={styles.taskName}>{empty.title}</Text>
                <Text style={styles.taskMeta}>{empty.text}</Text>
              </Animated.View>
            ) : null}

            {todo.map(({ course, assessment, studied, target }, i) => {
              const days = daysUntil(assessment.due, now);
              const first = i === 0;
              const isActive = active?.assessment.id === assessment.id;
              const status = statusHeading(isActive ? study.mode : 'idle', studied, target);
              return (
                <Animated.View
                  key={assessment.id}
                  entering={FadeInDown.delay(80 + i * 70)
                    .springify()
                    .damping(18)}
                  exiting={FadeOut.duration(200)}
                  layout={LinearTransition.springify().damping(18)}
                  style={[styles.task, first && styles.taskFirst, isActive && styles.taskActive]}>
                  <View style={styles.taskTop}>
                    <Text style={[styles.statusHeading, { color: status.color }]}>{status.text}</Text>
                    <Text style={[styles.countdown, { color: urgencyColor(days) }]}>{countdown(assessment.due, now)}</Text>
                  </View>
                  <Text style={styles.taskName}>{assessment.name}</Text>
                  <Text style={styles.taskMeta}>
                    {course.code} · {hoursLabel(hoursToday(assessment, course)).replace('~', '')} today · {assessment.weight}% of grade
                  </Text>
                  <View style={styles.taskProgress}>
                    <ProgressBar value={target ? studied / target : 0} color={T.accent} track={T.neutralSoft} height={6} />
                    <Text style={styles.taskProgressText}>
                      {minutesLabel(studied)} of {minutesLabel(target)}
                    </Text>
                  </View>
                  {smartFor.has(assessment.id) ? (
                    <View style={styles.why}>
                      <Text style={styles.whyText}>
                        <Text style={styles.whyLabel}>Why this? </Text>
                        {smartFor.get(assessment.id)!.reason || whyLabel(assessment, now)}
                      </Text>
                      {smartFor.get(assessment.id)!.topics.length ? (
                        <Text style={styles.whyText}>
                          <Text style={styles.whyLabel}>Focus: </Text>
                          {smartFor.get(assessment.id)!.topics.join(', ')}
                        </Text>
                      ) : null}
                    </View>
                  ) : first ? (
                    <View style={styles.why}>
                      <Text style={styles.whyText}>
                        <Text style={styles.whyLabel}>Why this? </Text>
                        {assessment.why ?? whyLabel(assessment, now)}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.actions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        !isActive ? startOn(assessment.id, assessment.status) : study.mode === 'break' ? study.resume() : study.takeBreak()
                      }
                      style={({ pressed }) => [styles.startBtn, !first && !isActive && styles.secondaryBtn, pressed && styles.pressed]}>
                      <Text style={[styles.startText, !first && !isActive && styles.secondaryText]}>
                        {isActive ? (study.mode === 'break' ? 'Back to it' : 'Take a break') : studied > 0 ? 'Resume timer' : 'Start timer'}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${course.code}`}
                      style={({ pressed }) => [styles.secondaryBtn, styles.courseBtn, pressed && styles.pressed]}
                      onPress={() =>
                        router.push({
                          pathname: '/course/[code]',
                          params: { code: course.code },
                        })
                      }>
                      <Text style={styles.secondaryText}>Course</Text>
                    </Pressable>
                  </View>
                </Animated.View>
              );
            })}

            {completed.length > 0 ? (
              <Animated.View layout={LinearTransition.springify().damping(18)}>
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

            {wide ? null : trajectory}
            <Text style={styles.footnote}>Only study time counts towards today. Breaks pause the clock.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** The next few deadlines across every course, filling the column under the timer on wide screens. */
function ComingUp({ courses, now, holidays }: { courses: Course[]; now: number; holidays: Map<string, string> }) {
  const next = upcoming(courses, now).slice(0, 5);
  if (next.length === 0) return null;
  return (
    <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.coming}>
      <Text style={typo.heading}>Coming up</Text>
      {next.map(({ course, assessment }) => (
        <Pressable
          key={assessment.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/course/[code]', params: { code: course.code } })}
          style={({ pressed }) => [styles.comingRow, pressed && styles.pressed]}>
          <View style={styles.comingText}>
            <Text style={styles.comingName} numberOfLines={1}>
              {assessment.name}
            </Text>
            <Text style={styles.comingMeta}>
              {course.code} · {dueLabel(assessment.due)}
              {assessment.due && holidays.has(dayKey(new Date(assessment.due).getTime())) ? <Text style={styles.holiday}> · Public holiday</Text> : null}
            </Text>
          </View>
          <Text style={[styles.comingDue, { color: urgencyColor(daysUntil(assessment.due, now)) }]}>
            {shortCountdown(assessment.due, now)}
          </Text>
        </Pressable>
      ))}
    </Animated.View>
  );
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
  if (mode === 'study') return { text: 'Studying now', color: T.accent };
  if (mode === 'break') return { text: 'On a break', color: T.warn };
  if (studied > 0)
    return {
      text: `In progress · ${Math.floor((studied / target) * 100)}%`,
      color: T.accent,
    };
  return { text: 'Not started', color: T.muted };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.ground },
  content: {
    padding: 20,
    paddingTop: 12,
    gap: 12,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  contentWide: {
    maxWidth: 1240,
    paddingHorizontal: 40,
    paddingTop: 28,
    gap: 20,
  },
  stack: { gap: 12 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  colWide: { flex: 1, minWidth: 0, gap: 12 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  headerText: { gap: 2 },
  date: { fontSize: 14, fontWeight: '500', color: T.muted },
  holiday: { color: T.accent, fontWeight: '600' },
  title: typo.display,
  examPill: {
    fontFamily: mono,
    fontSize: 12,
    color: T.muted,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
  },

  task: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.lg,
    padding: 18,
    gap: 6,
  },
  taskFirst: { borderColor: T.lineStrong },
  taskActive: { borderWidth: 2, borderColor: T.accent },
  taskTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusHeading: { fontFamily: font.semibold, fontSize: 14 },
  countdown: { fontFamily: monoBold, fontSize: 22, letterSpacing: -0.5 },
  taskName: { fontFamily: font.bold, fontSize: 18, color: T.ink, letterSpacing: -0.2 },
  taskMeta: { fontSize: 14, color: T.muted },
  taskProgress: { gap: 6, marginTop: 4 },
  taskProgressText: { fontFamily: mono, fontSize: 12, color: T.muted },
  why: {
    backgroundColor: T.ground,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  whyText: { fontSize: 13, lineHeight: 19, color: T.inkSoft },
  whyLabel: { fontWeight: '700', color: T.ink },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  startBtn: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startText: { fontSize: 15, fontWeight: '600', color: T.onAccent },
  secondaryBtn: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.line,
  },
  secondaryText: { fontSize: 15, fontWeight: '500', color: T.ink },
  courseBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },

  planBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 4 },
  planBarText: { flex: 1, fontSize: 13, color: T.muted },
  replanBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  replanText: { fontSize: 15, fontWeight: '600', color: T.accent },

  footnote: { fontSize: 13, color: T.muted, textAlign: 'center', marginTop: 4 },
  coming: { backgroundColor: T.surface, borderRadius: radius.lg, padding: 18, gap: 4 },
  comingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8 },
  comingText: { flex: 1, gap: 2 },
  comingName: { fontFamily: font.semibold, fontSize: 15, color: T.ink },
  comingMeta: { fontSize: 13, color: T.muted },
  comingDue: { fontFamily: monoBold, fontSize: 15 },
});
