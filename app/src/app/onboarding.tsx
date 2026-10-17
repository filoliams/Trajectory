import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorText, Field, Segmented, Select } from '@/components/form';
import { ProfileGuide } from '@/components/profile-guide';
import { ProfileUpload } from '@/components/profile-upload';
import { CURRENT_YEAR } from '@/config';
import { T } from '@/constants/trajectory';
import { UNIVERSITIES, semesterLabel } from '@/constants/universities';
import { useStore } from '@/lib/store';

/** Wide enough to show the upload box and the guide side by side. */
const SIDE_BY_SIDE = 820;

export default function OnboardingScreen() {
  const { profile, courses, setSemester, finishOnboarding, addCourseManually, signOut } = useStore();
  const { width } = useWindowDimensions();
  const [step, setStep] = useState<1 | 2>(1);
  const [semester, setSemesterChoice] = useState(profile?.semester ?? `${CURRENT_YEAR} S2`);
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const university = UNIVERSITIES.find((u) => u.id === universityId) ?? null;
  const wide = step === 2 && width >= SIDE_BY_SIDE;
  const cleanCode = manualCode.trim().toUpperCase().replace(/\s+/g, '');

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

  // For a course whose profile isn't out yet: add it now, fill in assessments later.
  async function addManually() {
    setError(null);
    if (!/^[A-Z]{4}\d{4}$/.test(cleanCode)) return setError('Course codes look like STAT2201: four letters then four digits.');
    setBusy(true);
    try {
      await addCourseManually(cleanCode, '');
      setManualCode('');
      setManualOpen(false);
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
        <ScrollView contentContainerStyle={[styles.content, wide && styles.contentWide]} keyboardShouldPersistTaps="handled">
          <View style={styles.progress}>
            <View style={[styles.bar, styles.barOn]} />
            <View style={[styles.bar, step === 2 && styles.barOn]} />
          </View>
          <Text style={styles.step}>Step {step} of 2</Text>

          {step === 1 ? (
            <>
              <Text style={styles.title}>Your semester</Text>
              <Text style={styles.body}>Trajectory plans one semester at a time.</Text>
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
                Upload the course profile for each of your courses. We'll read it for assessments, weightings and due dates,
                and mark anything we're unsure about for you to check.
              </Text>
              <Select
                label="University"
                placeholder="Choose your university"
                options={UNIVERSITIES.map((u) => ({ value: u.id, label: u.name }))}
                value={universityId}
                onChange={setUniversityId}
              />
              {university ? (
                <View style={[styles.upload, wide && styles.uploadWide]}>
                  <View style={[styles.uploadMain, wide && styles.flex]}>
                    <ProfileUpload profileName={university.profileName} />
                    {manualOpen ? (
                      <View style={styles.manual}>
                        <View style={styles.flex}>
                          <Field
                            label="Course code"
                            value={manualCode}
                            onChangeText={setManualCode}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            placeholder="e.g. MECH2100"
                            onSubmitEditing={addManually}
                          />
                        </View>
                        <View style={styles.manualBtn}>
                          <Button title="Add" onPress={addManually} loading={busy} />
                        </View>
                      </View>
                    ) : (
                      <Button
                        title="No profile yet? Add a course without one"
                        variant="ghost"
                        onPress={() => setManualOpen(true)}
                      />
                    )}
                  </View>
                  <View style={wide ? styles.guideWide : undefined}>
                    <ProfileGuide university={university} semesterLabel={semesterLabel(semester)} />
                  </View>
                </View>
              ) : null}
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
  contentWide: { maxWidth: 960 },
  progress: { flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 4, borderRadius: 999, backgroundColor: '#D5D8DE' },
  barOn: { backgroundColor: T.accent },
  step: { fontSize: 13, fontWeight: '500', color: T.muted },
  title: { fontSize: 30, fontWeight: '700', color: T.ink, letterSpacing: -0.6 },
  body: { fontSize: 15, lineHeight: 22, color: T.muted },
  upload: { gap: 16 },
  uploadWide: { flexDirection: 'row', alignItems: 'flex-start' },
  uploadMain: { gap: 4 },
  guideWide: { width: 340 },
  manual: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 6 },
  manualBtn: { width: 84 },
  footer: { marginTop: 'auto', gap: 8, paddingTop: 12 },
});
