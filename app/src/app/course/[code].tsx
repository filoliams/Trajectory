import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LevelChip, StatusChip } from '@/components/chips';
import { TopicList } from '@/components/topic-list';
import { T, mono } from '@/constants/trajectory';
import type { Assessment } from '@/data/courses';
import {
  byPriority,
  countdown,
  daysUntil,
  dueLabel,
  finishedOrPast,
  hoursLabel,
  percentToGo,
  undated,
  urgencyBarColor,
  urgencyColor,
  useNow,
  whyLabel,
} from '@/lib/planning';
import { useStore } from '@/lib/store';

export default function CourseDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { courses, loading, reload, setStatus } = useStore();
  const course = courses.find((c) => c.code === code);
  const now = useNow();

  if (!course) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <BackButton />
          <Text style={styles.metaText}>Course not found.</Text>
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

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
        <View style={styles.topBar}>
          <BackButton />
          <Pressable
            accessibilityRole="button"
            style={styles.textBtn}
            onPress={() => router.push({ pathname: '/course/manage', params: { code: course.code } })}>
            <Text style={styles.textBtnLabel}>Edit</Text>
          </Pressable>
        </View>

        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{course.code}</Text>
            <LevelChip level={course.level} />
          </View>
          <Text style={styles.subtitle}>{course.name}</Text>
          <View style={styles.tiles}>
            <Tile label="Still to go" value={`${percentToGo(course)}%`} />
            <Tile label="Work left" value={hoursLabel(workLeft)} />
            <Tile label="Due this week" value={String(dueThisWeek)} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Assessments by priority</Text>
            <Pressable
              accessibilityRole="button"
              style={styles.textBtn}
              onPress={() => router.push({ pathname: '/assessment/new', params: { course: course.code } })}>
              <Text style={styles.textBtnLabel}>+ Add</Text>
            </Pressable>
          </View>

          {ranked.length === 0 && noDate.length === 0 ? (
            <Text style={styles.empty}>Nothing left to do here. Add an assessment with + Add.</Text>
          ) : null}

          {ranked.map((a, i) => {
            const days = daysUntil(a.due, now);
            const first = i === 0;
            return (
              <Pressable key={a.id} onPress={() => openEdit(a)} style={[styles.item, first && styles.itemFirst]}>
                <View style={[styles.rank, first && styles.rankFirst]}>
                  <Text style={[styles.rankText, first && styles.rankTextFirst]}>{i + 1}</Text>
                </View>
                <View style={styles.itemBody}>
                  <View style={styles.itemTop}>
                    <Text style={styles.itemName}>{a.name}</Text>
                    <Text style={[styles.countdown, { color: urgencyColor(days) }]}>{countdown(a.due, now)}</Text>
                  </View>
                  <View style={styles.itemMeta}>
                    <Text style={styles.metaText}>{dueLabel(a.due)}</Text>
                    <Text style={styles.weight}>{a.weight}%</Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.min(Math.max(a.weight, 2), 100)}%`, backgroundColor: urgencyBarColor(days) }]} />
                  </View>
                  <View style={styles.statusRow}>
                    <StatusChip status={a.status} />
                    <Text style={styles.metaText}>{hoursLabel(a.hoursLeft)} left</Text>
                    {a.isHurdle ? <Text style={styles.hurdle}>Hurdle</Text> : null}
                    {a.needsReview ? <Text style={styles.review}>Check date</Text> : null}
                  </View>
                  <Text style={styles.why}>{a.needsReview && a.note ? a.note : (a.why ?? whyLabel(a, now))}</Text>
                  <View style={styles.quickRow}>
                    {a.status === 'not_started' ? (
                      <QuickButton label="Start" onPress={() => setStatus(a.id, 'in_progress')} />
                    ) : null}
                    <QuickButton label="Mark done" onPress={() => setStatus(a.id, 'done')} />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {noDate.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Needs a due date</Text>
            {noDate.map((a) => (
              <Pressable key={a.id} onPress={() => openEdit(a)} style={styles.simpleRow}>
                <Text style={styles.itemName}>{a.name}</Text>
                <Text style={styles.review}>Add date</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {finished.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Done or past</Text>
            {finished.map((a) => (
              <Pressable key={a.id} onPress={() => openEdit(a)} style={styles.simpleRow}>
                <Text style={[styles.itemName, styles.doneText]}>{a.name}</Text>
                <Text style={styles.metaText}>
                  {a.weight}% · {a.status === 'done' ? 'Done' : 'Past due'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <TopicList course={course} />
      </ScrollView>
    </SafeAreaView>
  );
}

function BackButton() {
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/courses'))}
      style={styles.back}
      accessibilityRole="button">
      <Text style={styles.textBtnLabel}>‹ Courses</Text>
    </Pressable>
  );
}

function QuickButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quick, pressed && styles.pressed]}>
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.ground },
  content: { padding: 16, paddingBottom: 40, gap: 18, maxWidth: 720, width: '100%', alignSelf: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { minHeight: 44, justifyContent: 'center' },
  textBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  textBtnLabel: { fontSize: 17, fontWeight: '600', color: T.accent },

  header: { gap: 6, paddingHorizontal: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 30, fontWeight: '700', color: T.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: T.muted },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 6 },
  tile: { flex: 1, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, padding: 10, gap: 2 },
  tileLabel: { fontSize: 11, color: T.muted },
  tileValue: { fontFamily: mono, fontSize: 17, fontWeight: '600', color: T.ink },

  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: T.ink, paddingHorizontal: 4 },
  empty: { fontSize: 14, color: T.muted, paddingHorizontal: 4 },

  item: { flexDirection: 'row', gap: 10, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 16, padding: 12, paddingHorizontal: 14 },
  itemFirst: { borderWidth: 1.5, borderColor: T.accent },
  rank: { width: 26, height: 26, borderRadius: 8, backgroundColor: T.neutralSoft, alignItems: 'center', justifyContent: 'center' },
  rankFirst: { backgroundColor: T.accent },
  rankText: { fontSize: 13, fontWeight: '600', color: T.inkSoft },
  rankTextFirst: { color: T.onAccent },
  itemBody: { flex: 1, gap: 5 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  itemName: { flex: 1, fontSize: 15, fontWeight: '600', color: T.ink },
  doneText: { color: T.muted, fontWeight: '500' },
  countdown: { fontFamily: mono, fontSize: 14, fontWeight: '600' },
  itemMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  metaText: { fontSize: 12, color: T.muted },
  weight: { fontFamily: mono, fontSize: 12, color: T.ink },
  track: { height: 4, borderRadius: 9, backgroundColor: T.lineSoft, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 9 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  hurdle: { fontSize: 12, fontWeight: '600', color: T.inkSoft, borderWidth: 1, borderColor: T.line, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  review: { fontSize: 12, fontWeight: '600', color: T.warn, backgroundColor: T.warnSoft, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  why: { fontSize: 12, lineHeight: 17, color: T.inkSoft },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  quick: { minHeight: 36, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' },
  quickText: { fontSize: 13, fontWeight: '600', color: T.ink },
  pressed: { opacity: 0.7 },
  simpleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
});
