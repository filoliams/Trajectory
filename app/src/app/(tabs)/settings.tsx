import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorText, Segmented } from '@/components/form';
import { CURRENT_YEAR } from '@/config';
import { T, radius, typo } from '@/constants/trajectory';
import { DAILY_HOURS_OPTIONS, useDailyHours } from '@/lib/daily-hours';
import { useStore } from '@/lib/store';

export default function SettingsScreen() {
  const { profile, session, setSemester, signOut, error, online, pendingCount } = useStore();
  const [hours, setHours] = useDailyHours();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <Section title="Study plan" hint="Today's plan fits into this. Courses with fewer topics covered in your notes get more of it.">
          <Segmented
            label="Study time each day"
            options={DAILY_HOURS_OPTIONS.map((h) => ({ value: String(h), label: `${h}h` }))}
            value={String(hours)}
            onChange={(v) => setHours(Number(v))}
          />
        </Section>

        <Section title="Semester" hint="Switching shows that semester's courses. Nothing is deleted.">
          <Segmented
            options={[
              { value: `${CURRENT_YEAR} S1`, label: `Sem 1, ${CURRENT_YEAR}` },
              { value: `${CURRENT_YEAR} S2`, label: `Sem 2, ${CURRENT_YEAR}` },
            ]}
            value={profile?.semester ?? `${CURRENT_YEAR} S2`}
            onChange={setSemester}
          />
          <ErrorText>{error}</ErrorText>
        </Section>

        <Section title="Account">
          <Row label="Signed in as" value={session?.user.email ?? ''} />
          <Row
            label="Sync"
            value={!online ? 'Offline — changes save when you reconnect' : pendingCount ? `${pendingCount} change(s) saving…` : 'Up to date'}
          />
          <Button title="Sign out" variant="secondary" onPress={signOut} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>{title}</Text>
      <View style={styles.card}>{children}</View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.ground },
  content: { padding: 20, paddingTop: 12, gap: 24, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { ...typo.display, marginBottom: 4 },
  section: { gap: 8 },
  eyebrow: { ...typo.eyebrow, paddingHorizontal: 4 },
  card: { backgroundColor: T.surface, borderWidth: 1, borderColor: 'transparent', borderRadius: radius.lg, padding: 16, gap: 14 },
  hint: { fontSize: 13, lineHeight: 18, color: T.muted, paddingHorizontal: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  rowLabel: { flexShrink: 0, fontSize: 15, color: T.muted },
  rowValue: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: T.ink },
});
