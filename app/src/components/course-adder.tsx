import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorText, Field } from '@/components/form';
import { T, mono } from '@/constants/trajectory';
import { courseInfoUrl, importCourse, importFromText, type ImportedCourse } from '@/lib/api';
import { parseSemester, useStore } from '@/lib/store';

type Result = { code: string; count: number; review: number };

/**
 * Type a course code → the backend tries to read its UQ course profile.
 * UQ's site may block automatic downloads, so the fallback is: open the
 * profile, copy the Assessment summary table, paste it here.
 */
export function CourseAdder({ onAdded }: { onAdded?: (code: string) => void }) {
  const { profile, saveImportedCourse, addCourseManually } = useStore();
  const [code, setCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackFor, setFallbackFor] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);

  const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '');
  const validCode = /^[A-Z]{4}\d{4}$/.test(cleanCode);

  function reset() {
    setCode('');
    setCourseName('');
    setPasted('');
    setFallbackFor(null);
  }

  async function save(imported: ImportedCourse) {
    const withName = { ...imported, title: imported.title ?? (courseName.trim() || null) };
    await saveImportedCourse(withName);
    setResults((r) => [
      { code: imported.code, count: imported.assessments.length, review: imported.assessments.filter((a) => a.needs_review).length },
      ...r.filter((x) => x.code !== imported.code),
    ]);
    reset();
    onAdded?.(imported.code);
  }

  async function runImport() {
    setError(null);
    if (!validCode) return setError('Course codes look like STAT2201: four letters then four digits.');
    setBusy(true);
    try {
      const { year, semester } = parseSemester(profile?.semester ?? '2026 S2');
      await save(await importCourse(cleanCode, year, semester));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setFallbackFor(cleanCode);
    } finally {
      setBusy(false);
    }
  }

  async function runPaste() {
    setError(null);
    setBusy(true);
    try {
      await save(await importFromText(cleanCode, pasted));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addManually() {
    setError(null);
    setBusy(true);
    try {
      await addCourseManually(cleanCode, courseName);
      setResults((r) => [{ code: cleanCode, count: 0, review: 0 }, ...r]);
      reset();
      onAdded?.(cleanCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const showFallback = fallbackFor !== null && fallbackFor === cleanCode;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Field
            label="Course code"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="e.g. MECH2100"
            onSubmitEditing={runImport}
          />
        </View>
        <View style={styles.addBtn}>
          <Button title="Add" onPress={runImport} loading={busy && !showFallback} />
        </View>
      </View>

      <ErrorText>{error}</ErrorText>

      {showFallback ? (
        <View style={styles.fallback}>
          <Text style={styles.fallbackTitle}>Paste {cleanCode}'s assessment table</Text>
          <Text style={styles.step}>1. Open the course page and tap Course Profile for this semester.</Text>
          <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(courseInfoUrl(cleanCode))}>
            <Text style={styles.link}>Open {cleanCode} on UQ's site ↗</Text>
          </Pressable>
          <Text style={styles.step}>
            2. Scroll to Assessment summary. Select the whole table, from "Category" to the last due date, and copy it.
          </Text>
          <Text style={styles.step}>3. Paste it below.</Text>
          <Field
            label="Assessment table"
            value={pasted}
            onChangeText={setPasted}
            multiline
            textAlignVertical="top"
            style={styles.textarea}
            placeholder="Category  Assessment task  Weight  Due date…"
          />
          <Field label="Course name (optional)" value={courseName} onChangeText={setCourseName} placeholder="e.g. Machine Element Design" />
          <Button title="Import from pasted table" onPress={runPaste} loading={busy} disabled={!pasted.trim()} />
          <Button title={`Add ${cleanCode} with no assessments`} variant="ghost" onPress={addManually} disabled={busy} />
        </View>
      ) : null}

      {results.map((r) => (
        <View key={r.code} style={styles.result}>
          <Text style={styles.resultCode}>{r.code}</Text>
          <Text style={[styles.resultText, r.review > 0 && styles.resultWarn]}>
            {r.count === 0
              ? 'Added. Add its assessments from the course page.'
              : `${r.count} assessments imported${r.review ? ` · ${r.review} to check` : ''}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  flex: { flex: 1 },
  addBtn: { width: 84 },
  fallback: { gap: 10, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 16, padding: 14 },
  fallbackTitle: { fontSize: 16, fontWeight: '600', color: T.ink },
  step: { fontSize: 14, lineHeight: 20, color: T.inkSoft },
  link: { fontSize: 15, fontWeight: '600', color: T.accent, paddingVertical: 6 },
  textarea: {
    minHeight: 140,
    height: 140,
    borderWidth: 1.5,
    borderColor: '#C9CDD4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    fontSize: 14,
    color: T.ink,
    backgroundColor: T.surface,
  },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 14, padding: 12 },
  resultCode: { fontFamily: mono, fontSize: 14, color: T.ink },
  resultText: { flex: 1, fontSize: 13, color: T.muted },
  resultWarn: { color: T.warn },
});
