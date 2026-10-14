import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CourseAdder } from '@/components/course-adder';
import { Button, ErrorText, Segmented } from '@/components/form';
import { CURRENT_YEAR, UNIVERSITY } from '@/config';
import { T } from '@/constants/trajectory';
import { useStore } from '@/lib/store';

export default function OnboardingScreen() {
  const { profile, courses, setSemester, finishOnboarding, signOut } = useStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [semester, setSemesterChoice] = useState(profile?.semester ?? `${CURRENT_YEAR} S2`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function next() {
    setBusy(true);
    setError(null);
    try {
      await setSemester(semester);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      await finishOnboarding();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.progress}>
            <View style={[styles.bar, styles.barOn]} />
            <View style={[styles.bar, step === 2 && styles.barOn]} />
          </View>
          <Text style={styles.step}>Step {step} of 2</Text>

          {step === 1 ? (
            <>
              <Text style={styles.title}>Your semester</Text>
              <Text style={styles.body}>Trajectory plans one semester at a time.</Text>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>University</Text>
                <Text style={styles.cardValue}>{UNIVERSITY}</Text>
              </View>
              <Segmented
                label="Semester"
                options={[
                  { value: `${CURRENT_YEAR} S1`, label: `Sem 1, ${CURRENT_YEAR}` },
                  { value: `${CURRENT_YEAR} S2`, label: `Sem 2, ${CURRENT_YEAR}` },
                ]}
                value={semester}
                onChange={setSemesterChoice}
              />
              <ErrorText>{error}</ErrorText>
              <View style={styles.footer}>
                <Button title="Continue" onPress={next} loading={busy} />
                <Button title="Sign out" variant="ghost" onPress={signOut} />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>Add your courses</Text>
              <Text style={styles.body}>
                We'll read each course profile for its assessments, weightings and due dates. Anything we're unsure about is
                marked for you to check.
              </Text>
              <CourseAdder />
              <ErrorText>{error}</ErrorText>
              <View style={styles.footer}>
                <Button
                  title={courses.length ? `Continue with ${courses.length} course${courses.length === 1 ? '' : 's'}` : 'Continue'}
                  onPress={finish}
                  loading={busy}
                  disabled={!courses.length}
                />
                <Button title="Back" variant="ghost" onPress={() => setStep(1)} />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.ground },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 20, paddingTop: 16, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center' },
  progress: { flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 4, borderRadius: 999, backgroundColor: '#D5D8DE' },
  barOn: { backgroundColor: T.accent },
  step: { fontSize: 13, fontWeight: '500', color: T.muted },
  title: { fontSize: 30, fontWeight: '700', color: T.ink, letterSpacing: -0.6 },
  body: { fontSize: 15, lineHeight: 22, color: T.muted },
  card: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 14, padding: 14, gap: 2 },
  cardLabel: { fontSize: 12, color: T.muted },
  cardValue: { fontSize: 15, fontWeight: '600', color: T.ink },
  footer: { marginTop: 'auto', gap: 8, paddingTop: 12 },
});
