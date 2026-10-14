import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LevelChip } from '@/components/chips';
import { Button, ErrorText } from '@/components/form';
import { T, mono } from '@/constants/trajectory';
import { percentToGo } from '@/lib/planning';
import { useStore } from '@/lib/store';

export default function CoursesScreen() {
  const { courses, loading, error, reload, profile, signOut, session } = useStore();

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
          return (
            <Pressable
              key={course.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/course/[code]', params: { code: course.code } })}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={styles.cardTop}>
                <View style={styles.cardText}>
                  <Text style={styles.code}>{course.code}</Text>
                  <Text style={styles.name}>{course.name}</Text>
                </View>
                <LevelChip level={course.level} />
              </View>
              <View style={styles.progressRow}>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.max(0, 100 - toGo)}%` }]} />
                </View>
                <Text style={styles.toGo}>{toGo}% to go</Text>
              </View>
            </Pressable>
          );
        })}

        <View style={styles.account}>
          <Text style={styles.accountText}>Signed in as {session?.user.email}</Text>
          <Button title="Sign out" variant="ghost" onPress={signOut} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.ground },
  content: { padding: 16, paddingTop: 12, gap: 10, maxWidth: 720, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6, paddingHorizontal: 4 },
  title: { fontSize: 34, fontWeight: '700', color: T.ink, letterSpacing: -0.6 },
  semester: { fontSize: 13, color: T.muted },
  addBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 26, lineHeight: 28, color: '#FFFFFF', fontWeight: '500' },
  empty: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 18, padding: 20, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: T.ink },
  emptyText: { fontSize: 14, color: T.muted },
  card: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 18, padding: 16, gap: 12 },
  pressed: { opacity: 0.7 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  cardText: { flex: 1, gap: 2 },
  code: { fontSize: 20, fontWeight: '700', color: T.ink },
  name: { fontSize: 13, color: T.muted },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 6, borderRadius: 9, backgroundColor: T.lineSoft, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: T.ink, borderRadius: 9 },
  toGo: { fontFamily: mono, fontSize: 12, fontWeight: '600', color: T.inkSoft },
  account: { marginTop: 24, alignItems: 'center', gap: 2 },
  accountText: { fontSize: 12, color: T.muted },
});
