import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useEffect } from 'react';
import Animated, { FadeInDown, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LevelChip } from '@/components/chips';
import { Button, ErrorText } from '@/components/form';
import { PressScale } from '@/components/press-scale';
import { T, WIDE, font, mono, radius, typo } from '@/constants/trajectory';
import { byPriority, countdown, daysUntil, notesLevel, percentToGo, shareDone, urgencyColor, useNow } from '@/lib/planning';
import { useStore } from '@/lib/store';

export default function CoursesScreen() {
  const { courses, loading, error, reload, profile } = useStore();
  const now = useNow();
  const wide = useWindowDimensions().width >= WIDE;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, wide && styles.contentWide]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Courses</Text>
            <Text style={styles.semester}>{profile?.semester.replace(' S', ', Semester ')}</Text>
          </View>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Add course"
            onPress={() => router.push('/course/add')}
            style={styles.addBtn}>
            <Text style={styles.addText}>+</Text>
          </PressScale>
        </View>

        <ErrorText>{error}</ErrorText>

        {courses.length === 0 && loading ? (
          <View style={styles.list}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : null}

        {courses.length === 0 && !loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No courses yet</Text>
            <Text style={styles.emptyText}>Add a course and we’ll import its assessments.</Text>
            <Button title="Add a course" onPress={() => router.push('/course/add')} />
          </View>
        ) : null}

        <View style={wide ? styles.grid : styles.list}>
          {courses.map((course, i) => {
            const toGo = percentToGo(course);
            const next = byPriority(course.assessments, now)[0];
            return (
              <Animated.View
                key={course.id}
                entering={FadeInDown.delay(i * 60)
                  .springify()
                  .damping(18)}
                style={wide && styles.cell}>
                <PressScale
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/course/[code]', params: { code: course.code } })}
                  style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardText}>
                      <Text style={styles.code}>{course.code}</Text>
                      {course.name ? <Text style={styles.name}>{course.name}</Text> : null}
                    </View>
                    <LevelChip level={notesLevel(course)} />
                  </View>
                  {next ? (
                    <View style={styles.next}>
                      <Text style={styles.nextLabel}>Next</Text>
                      <Text style={styles.nextName} numberOfLines={1}>
                        {next.name}
                      </Text>
                      <Text style={[styles.nextDue, { color: urgencyColor(daysUntil(next.due, now)) }]}>{countdown(next.due, now)}</Text>
                    </View>
                  ) : null}
                  <View style={styles.progressRow}>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${Math.round(shareDone(course) * 100)}%` }]} />
                    </View>
                    <Text style={styles.toGo}>{toGo}% to go</Text>
                  </View>
                </PressScale>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
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
    <Animated.View style={[styles.card, style]} accessibilityLabel="Loading courses">
      <View style={[styles.bone, { width: 120, height: 22 }]} />
      <View style={[styles.bone, { height: 44, borderRadius: radius.md }]} />
      <View style={[styles.bone, { height: 6 }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.ground },
  content: { padding: 16, paddingTop: 12, gap: 10, maxWidth: 720, width: '100%', alignSelf: 'center' },
  contentWide: { maxWidth: 1240, paddingHorizontal: 40, paddingTop: 28 },
  list: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 },
  cell: { width: '49%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6, paddingHorizontal: 4 },
  title: typo.display,
  semester: { fontSize: 13, color: T.muted },
  addBtn: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 26, lineHeight: 28, color: T.onAccent, fontWeight: '500' },
  empty: { backgroundColor: T.surface, borderWidth: 1, borderColor: 'transparent', borderRadius: radius.lg, padding: 20, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: T.ink },
  emptyText: { fontSize: 14, color: T.muted },
  card: { backgroundColor: T.surface, borderWidth: 1, borderColor: 'transparent', borderRadius: radius.lg, padding: 16, gap: 12 },
  bone: { backgroundColor: T.elevated, borderRadius: radius.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  cardText: { flex: 1, gap: 2 },
  code: { fontFamily: font.bold, fontSize: 22, color: T.ink, letterSpacing: -0.4 },
  name: { fontSize: 13, color: T.muted },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.elevated,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  nextLabel: { ...typo.eyebrow, fontSize: 11 },
  nextName: { flex: 1, fontSize: 14, fontWeight: '600', color: T.ink },
  nextDue: { fontFamily: mono, fontSize: 13, fontWeight: '700' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 6, borderRadius: 9, backgroundColor: T.lineSoft, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: T.accent, borderRadius: 9 },
  toGo: { fontFamily: mono, fontSize: 12, fontWeight: '600', color: T.inkSoft },
});
