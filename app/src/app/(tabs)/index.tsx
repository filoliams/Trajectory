import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CompletedToday } from '@/components/completed-today';
import { ProgressBar, StudyTimer } from '@/components/study-timer';
import { T, mono } from '@/constants/trajectory';
import type { Status } from '@/data/courses';
import { countdown, daysUntil, hoursLabel, todayHours, todaysPlan, urgencyColor, whyLabel } from '@/lib/planning';
import { useStore } from '@/lib/store';
import { minutesLabel, useStudySession } from '@/lib/study-session';

// Phase 2 makes this a setting.
const HOURS_AVAILABLE = 4;
const HOUR_MS = 3_600_000;

export default function TodayScreen() {
  const study = useStudySession();
  const { now } = study;
  const { courses, setStatus } = useStore();
  const plan = todaysPlan(courses, now, HOURS_AVAILABLE);
  const plannedHours = plan.reduce((sum, p) => sum + todayHours(p.assessment), 0);
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
      const target = todayHours(assessment) * HOUR_MS;
      return { course, assessment, studied, target, finished: studied > 0 && studied >= target };
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

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.date}>{dateLabel}</Text>
            <Text style={styles.title}>Today</Text>
          </View>
          {examDays !== null ? <Text style={styles.examPill}>exams in {examDays}d</Text> : null}
        </View>

        <Animated.View entering={FadeInDown.duration(400)}>
          <StudyTimer
            mode={active ? study.mode : 'idle'}
            current={
              active
                ? { label: `${active.course.code} · ${active.assessment.name}`, studiedMs: active.studied, targetMs: active.target }
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

        {todo.length === 0 && completed.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(80)} style={styles.task}>
            <Text style={styles.taskName}>{courses.length ? 'Nothing due right now' : 'No courses yet'}</Text>
            <Text style={styles.taskMeta}>
              {courses.length
                ? 'Everything with a due date is done. Nice work.'
                : 'Add your courses from the Courses tab to get a plan.'}
            </Text>
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
              entering={FadeInDown.delay(80 + i * 70).springify().damping(18)}
              exiting={FadeOut.duration(200)}
              layout={LinearTransition.springify().damping(18)}
              style={[styles.task, first && styles.taskFirst, isActive && styles.taskActive]}>
              <View style={styles.taskTop}>
                <Text style={[styles.statusHeading, { color: status.color }]}>{status.text}</Text>
                <Text style={[styles.countdown, { color: urgencyColor(days) }]}>{countdown(assessment.due, now)}</Text>
              </View>
              <Text style={styles.taskName}>{assessment.name}</Text>
              <Text style={styles.taskMeta}>
                {course.code} · {hoursLabel(todayHours(assessment)).replace('~', '')} today · {assessment.weight}% of grade
              </Text>
              <View style={styles.taskProgress}>
                <ProgressBar value={target ? studied / target : 0} color={T.accent} track={T.neutralSoft} height={6} />
                <Text style={styles.taskProgressText}>
                  {minutesLabel(studied)} of {minutesLabel(target)}
                </Text>
              </View>
              {first && (
                <View style={styles.why}>
                  <Text style={styles.whyText}>
                    <Text style={styles.whyLabel}>Why this? </Text>
                    {assessment.why ?? whyLabel(assessment, now)}
                  </Text>
                </View>
              )}
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
                  style={({ pressed }) => [styles.secondaryBtn, styles.courseBtn, pressed && styles.pressed]}
                  onPress={() => router.push({ pathname: '/course/[code]', params: { code: course.code } })}>
                  <Text style={styles.secondaryText}>Course</Text>
                </Pressable>
              </View>
            </Animated.View>
          );
        })}

        {completed.length > 0 ? (
          <Animated.View layout={LinearTransition.springify().damping(18)}>
            <CompletedToday items={completed.map((c) => ({ id: c.assessment.id, name: c.assessment.name, code: c.course.code, studied: c.studied }))} />
          </Animated.View>
        ) : null}

        <Text style={styles.footnote}>Only study time counts towards today. Breaks pause the clock.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/** The heading on each card, from today's progress alone. */
function statusHeading(mode: 'idle' | 'study' | 'break', studied: number, target: number): { text: string; color: string } {
  if (mode === 'study') return { text: 'Studying now', color: T.accent };
  if (mode === 'break') return { text: 'On a break', color: T.warn };
  if (studied > 0) return { text: `In progress · ${Math.floor((studied / target) * 100)}%`, color: T.accent };
  return { text: 'Not started', color: T.muted };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.ground },
  content: { padding: 20, paddingTop: 12, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 },
  headerText: { gap: 2 },
  date: { fontSize: 14, fontWeight: '500', color: T.muted },
  title: { fontSize: 40, fontWeight: '800', color: T.ink, letterSpacing: -1.2 },
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

  task: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 22, padding: 18, gap: 6 },
  taskFirst: { borderColor: T.lineStrong },
  taskActive: { borderWidth: 2, borderColor: T.accent },
  taskTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusHeading: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  countdown: { fontFamily: mono, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  taskName: { fontSize: 17, fontWeight: '600', color: T.ink },
  taskMeta: { fontSize: 14, color: T.muted },
  taskProgress: { gap: 6, marginTop: 4 },
  taskProgressText: { fontFamily: mono, fontSize: 12, color: T.muted },
  why: { backgroundColor: T.ground, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginTop: 4 },
  whyText: { fontSize: 13, lineHeight: 19, color: T.inkSoft },
  whyLabel: { fontWeight: '700', color: T.ink },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  startBtn: { flex: 1, height: 44, borderRadius: 999, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
  startText: { fontSize: 15, fontWeight: '600', color: T.onAccent },
  secondaryBtn: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line },
  secondaryText: { fontSize: 15, fontWeight: '500', color: T.ink },
  courseBtn: { height: 44, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },

  footnote: { fontSize: 13, color: T.muted, textAlign: 'center', marginTop: 4 },
});
