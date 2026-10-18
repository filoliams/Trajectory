import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, ErrorText, Field } from '@/components/form';
import { ProfileGuide } from '@/components/profile-guide';
import { ProfileUpload } from '@/components/profile-upload';
import { Sheet } from '@/components/sheet';
import { CURRENT_YEAR } from '@/config';
import { T, mono, radius } from '@/constants/trajectory';
import { UNIVERSITIES, semesterLabel } from '@/constants/universities';
import { useStore } from '@/lib/store';

// The university picked in onboarding isn't stored; UQ is the only one supported so far.
const university = UNIVERSITIES[0];

export default function AddCourseScreen() {
  const { profile, addCourseManually } = useStore();
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanCode = manualCode.trim().toUpperCase().replace(/\s+/g, '');

  // For a course whose profile isn't out yet: add it now, fill in assessments later.
  async function addManually() {
    setError(null);
    if (!/^[A-Z]{4}\d{4}$/.test(cleanCode)) return setError('Course codes look like STAT2201: four letters then four digits.');
    setBusy(true);
    try {
      await addCourseManually(cleanCode, '');
      setAdded((list) => [cleanCode, ...list.filter((c) => c !== cleanCode)]);
      setManualCode('');
      setManualOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Add a course">
      <Text style={styles.body}>
        Upload the {university.profileName} for each course you are adding. We will read it for assessments, weightings and due
        dates. Uploading a course you already have refreshes its imported assessments and keeps the ones you added yourself.
      </Text>
      <ProfileUpload profileName={university.profileName} />
      {added.map((code) => (
        <View key={code} style={styles.result}>
          <Text style={styles.resultCode}>{code}</Text>
          <Text style={styles.resultText}>Added. Add its assessments from the course page.</Text>
        </View>
      ))}
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
        <Button title="No profile yet? Add a course without one" variant="ghost" onPress={() => setManualOpen(true)} />
      )}
      <ErrorText>{error}</ErrorText>
      <ProfileGuide university={university} semesterLabel={semesterLabel(profile?.semester ?? `${CURRENT_YEAR} S2`)} />
      <Button title="Done" variant="secondary" onPress={() => router.back()} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { fontSize: 15, lineHeight: 22, color: T.muted },
  manual: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  manualBtn: { width: 84 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.surface, borderWidth: 1, borderColor: 'transparent', borderRadius: radius.md, padding: 12 },
  resultCode: { fontFamily: mono, fontSize: 14, color: T.ink },
  resultText: { flex: 1, fontSize: 13, color: T.muted },
});
