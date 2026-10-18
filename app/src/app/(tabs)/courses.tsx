import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LevelChip } from '@/components/chips';
import { Button, ErrorText } from '@/components/form';
import { T, mono, radius, typo } from '@/constants/trajectory';
import { byPriority, countdown, daysUntil, notesLevel, percentToGo, shareDone, urgencyColor, useNow } from '@/lib/planning';
import { useStore } from '@/lib/store';

export default function CoursesScreen() {
  const { courses, loading, error, reload, profile } = useStore();
  const now = useNow();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Courses</Text>
            <Text style={styles.semester}>{profile?.semester.replace(' S', ', Semester ')}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Add course" onPress={() => router.push('/course/add')} style={styles.addBtn}>
            <Text style={styles.addText}>+</Text>
          </Pressable>
        </View>

        <ErrorText>{error}</ErrorText>

        {courses.length === 0 && !loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No courses yet</Text>
            <Text style={styles.emptyText}>Add a course and we'll import its assessments.</Text>
            <Button title="Add a course" onPress={() => router.push('/course/add')} />
          </View>
        ) : null}

        {courses.map((course) => {
          const toGo = percentToGo(course);
          const next = byPriority(course.assessments, now)[0];
          return (
            <Pressable
              key={course.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/course/[code]', params: { code: course.code } })}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
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
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.ground },
  content: { padding: 16, paddingTop: 12, gap: 10, maxWidth: 720, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6, paddingHorizontal: 4 },
  title: typo.display,
  semester: { fontSize: 13, color: T.muted },
  addBtn: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 26, lineHeight: 28, color: T.onAccent, fontWeight: '500' },
  empty: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: radius.lg, padding: 20, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: T.ink },
  emptyText: { fontSize: 14, color: T.muted },
  card: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: radius.lg, padding: 16, gap: 12 },
  pressed: { opacity: 0.7 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  cardText: { flex: 1, gap: 2 },
  code: { fontSize: 20, fontWeight: '700', color: T.ink },
  name: { fontSize: 13, color: T.muted },
  next: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.elevated, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  nextLabel: { ...typo.eyebrow, fontSize: 11 },
  nextName: { flex: 1, fontSize: 14, fontWeight: '600', color: T.ink },
  nextDue: { fontFamily: mono, fontSize: 13, fontWeight: '700' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 6, borderRadius: 9, backgroundColor: T.lineSoft, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: T.accent, borderRadius: 9 },
  toGo: { fontFamily: mono, fontSize: 12, fontWeight: '600', color: T.inkSoft },
});
