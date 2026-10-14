import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T, mono } from '@/constants/trajectory';
import { countdown, daysUntil, hoursLabel, todaysPlan, urgencyColor, useNow, whyLabel } from '@/lib/planning';
import { useStore } from '@/lib/store';

// Phase 2 makes this a setting.
const HOURS_AVAILABLE = 4;

export default function TodayScreen() {
  const now = useNow();
  const { courses, setStatus } = useStore();
  const plan = todaysPlan(courses, now, HOURS_AVAILABLE);
  const plannedHours = plan.reduce((sum, p) => sum + Math.min(p.assessment.hoursLeft, 1.5), 0);
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

        <View style={styles.summary}>
          <View style={styles.summaryTop}>
            <Text style={styles.summaryBig}>
              {hoursLabel(plannedHours).replace('~', '')} <Text style={styles.summarySmall}>planned</Text>
            </Text>
            <Text style={styles.summaryMuted}>of {HOURS_AVAILABLE}h free</Text>
          </View>
          <View style={styles.summaryTrack}>
            <View style={[styles.summaryFill, { width: `${Math.min((plannedHours / HOURS_AVAILABLE) * 100, 100)}%` }]} />
          </View>
          <Text style={styles.summaryMuted}>
            {plan.filter((p) => p.assessment.status === 'in_progress').length} of {plan.length} started
          </Text>
        </View>

        {plan.length === 0 ? (
          <View style={styles.task}>
            <Text style={styles.taskName}>{courses.length ? 'Nothing due right now' : 'No courses yet'}</Text>
            <Text style={styles.taskMeta}>
              {courses.length
                ? 'Everything with a due date is done. Nice work.'
                : 'Add your courses from the Courses tab to get a plan.'}
            </Text>
          </View>
        ) : null}

        {plan.map(({ course, assessment }, i) => {
          const days = daysUntil(assessment.due, now);
          const first = i === 0;
          return (
            <View key={assessment.id} style={[styles.task, first && styles.taskFirst]}>
              <View style={styles.taskTop}>
                <Text style={styles.taskCourse}>
                  {i + 1} · {course.code}
                </Text>
                <Text style={[styles.countdown, { color: urgencyColor(days) }]}>{countdown(assessment.due, now)}</Text>
              </View>
              <Text style={styles.taskName}>{assessment.name}</Text>
              <Text style={styles.taskMeta}>
                {hoursLabel(Math.min(assessment.hoursLeft, 1.5)).replace('~', '')} today · {assessment.weight}% of grade
              </Text>
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
                  onPress={() => setStatus(assessment.id, assessment.status === 'in_progress' ? 'done' : 'in_progress')}
                  style={({ pressed }) => [styles.startBtn, !first && styles.secondaryBtn, pressed && styles.pressed]}>
                  <Text style={[styles.startText, !first && styles.secondaryText]}>
                    {assessment.status === 'in_progress' ? 'Mark done' : 'Start'}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.secondaryBtn, styles.courseBtn, pressed && styles.pressed]}
                  onPress={() => router.push({ pathname: '/course/[code]', params: { code: course.code } })}>
                  <Text style={styles.secondaryText}>Course</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        <Text style={styles.footnote}>The plan updates as you start and finish things.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.ground },
  content: { padding: 20, paddingTop: 12, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 },
  headerText: { gap: 2 },
  date: { fontSize: 14, fontWeight: '500', color: T.muted },
  title: { fontSize: 34, fontWeight: '700', color: T.ink, letterSpacing: -0.6 },
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

  summary: { backgroundColor: T.ink, borderRadius: 20, padding: 18, gap: 12 },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  summaryBig: { fontSize: 28, fontWeight: '600', color: '#FFFFFF' },
  summarySmall: { fontSize: 15, fontWeight: '500', color: T.onDarkMuted },
  summaryMuted: { fontSize: 13, color: T.onDarkMuted },
  summaryTrack: { height: 8, borderRadius: 999, backgroundColor: '#33363E', overflow: 'hidden' },
  summaryFill: { height: '100%', borderRadius: 999, backgroundColor: T.accent },

  task: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 18, padding: 16, gap: 6 },
  taskFirst: { borderWidth: 1.5, borderColor: T.ink },
  taskTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskCourse: { fontFamily: mono, fontSize: 12, color: T.muted },
  countdown: { fontFamily: mono, fontSize: 13, fontWeight: '600' },
  taskName: { fontSize: 17, fontWeight: '600', color: T.ink },
  taskMeta: { fontSize: 14, color: T.muted },
  why: { backgroundColor: T.ground, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginTop: 4 },
  whyText: { fontSize: 13, lineHeight: 19, color: T.inkSoft },
  whyLabel: { fontWeight: '700', color: T.ink },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  startBtn: { flex: 1, height: 44, borderRadius: 12, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
  startText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  secondaryBtn: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line },
  secondaryText: { fontSize: 15, fontWeight: '500', color: T.ink },
  courseBtn: { height: 44, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  footnote: { fontSize: 13, color: T.muted, textAlign: 'center', marginTop: 4 },
});
