import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ErrorText } from '@/components/form';
import { T, radius, typo } from '@/constants/trajectory';
import type { Course, Topic } from '@/data/courses';
import { coveredTopics } from '@/lib/notes-match';
import { useStore } from '@/lib/store';

const NOTE_EXT = /\.(md|markdown|txt)$/i;

/** Every topic in a course, each marked with whether the student has notes for it. */
export function TopicList({ course }: { course: Course }) {
  const { addTopic, setTopicNotes, deleteTopic } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [importResult, setImportResult] = useState<string | null>(null);

  const topics = course.topics;
  const withNotes = topics.filter((t) => t.hasNotes).length;

  /** Read Markdown/text notes (an Obsidian vault, exported notes) and tick off the topics they cover. */
  async function importNotes() {
    setError(null);
    setImportResult(null);
    const picked = await DocumentPicker.getDocumentAsync({ multiple: true, type: '*/*', copyToCacheDirectory: true });
    if (picked.canceled) return;
    const files = picked.assets.filter((f) => NOTE_EXT.test(f.name));
    if (files.length === 0) return setError('Choose Markdown (.md) or text (.txt) notes, for example from your Obsidian vault.');
    setBusy(true);
    try {
      const texts = await Promise.all(files.map((f) => (f.file ? f.file.text() : fetch(f.uri).then((r) => r.text()))));
      // File names often are the topic, e.g. "Hypothesis testing.md".
      const found = coveredTopics(
        topics.filter((t) => !t.hasNotes),
        [...texts, ...files.map((f) => f.name.replace(NOTE_EXT, ''))],
      );
      await Promise.all(found.map((t) => setTopicNotes(t.id, true)));
      const from = `${files.length} file${files.length === 1 ? '' : 's'}`;
      setImportResult(found.length ? `Ticked ${found.length} topic${found.length === 1 ? '' : 's'} from ${from}.` : `No new topics found in ${from}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    const name = draft.trim();
    if (!name) return;
    if (topics.some((t) => t.name.toLowerCase() === name.toLowerCase())) return setError(`"${name}" is already a topic.`);
    setBusy(true);
    setError(null);
    try {
      await addTopic(course.id, name);
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: Topic) {
    setError(null);
    try {
      await deleteTopic(t.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.title}>Topics</Text>
          {topics.length > 0 ? (
            <Text style={styles.meta}>
              {withNotes} of {topics.length} with notes
            </Text>
          ) : null}
        </View>
        <View style={styles.headActions}>
          {topics.length > 0 && !editing ? (
            <Pressable accessibilityRole="button" disabled={busy} style={styles.textBtn} onPress={importNotes}>
              <Text style={styles.textBtnLabel}>{busy ? 'Reading…' : 'Import notes'}</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" style={styles.textBtn} onPress={() => setEditing((e) => !e)}>
            <Text style={styles.textBtnLabel}>{editing ? 'Done' : topics.length ? 'Edit' : '+ Add'}</Text>
          </Pressable>
        </View>
      </View>
      {importResult ? <Text style={styles.result}>{importResult}</Text> : null}

      {topics.length > 0 ? (
        <View style={styles.list}>
          {topics.map((t, i) => (
            <View key={t.id} style={[styles.row, i < topics.length - 1 && styles.divider]}>
              <View style={[styles.dot, t.hasNotes ? styles.dotOn : styles.dotOff]} />
              <View style={styles.rowText}>
                <Text style={styles.name}>{t.name}</Text>
                {t.week ? <Text style={styles.meta}>{t.week}</Text> : null}
              </View>
              {editing ? (
                <Pressable accessibilityRole="button" onPress={() => remove(t)} style={styles.remove}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              ) : (
                <NotesIndicator hasNotes={t.hasNotes} onPress={() => setTopicNotes(t.id, !t.hasNotes)} />
              )}
            </View>
          ))}
        </View>
      ) : !editing ? (
        <View style={styles.empty}>
          <Text style={styles.name}>No topics yet</Text>
          <Text style={styles.meta}>
            This course profile doesn't list weekly topics. Add them from your lecture schedule with + Add, then tap
            each one's notes marker once you've written notes for it.
          </Text>
        </View>
      ) : null}

      {editing ? (
        <View style={styles.addRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a topic, e.g. Hypothesis testing"
            placeholderTextColor={T.placeholder}
            style={styles.input}
            onSubmitEditing={add}
            returnKeyType="done"
            autoFocus={topics.length === 0}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy || !draft.trim()}
            onPress={add}
            style={({ pressed }) => [styles.addBtn, (busy || !draft.trim()) && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>
      ) : null}
      <ErrorText>{error}</ErrorText>
      {topics.length > 0 && !editing ? (
        <Text style={styles.hint}>Tap a notes marker to change it, or use Import notes to tick off topics from your Markdown or text notes.</Text>
      ) : null}
    </View>
  );
}

function NotesIndicator({ hasNotes, onPress }: { hasNotes: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: hasNotes }}
      accessibilityLabel={hasNotes ? 'Has notes' : 'No notes'}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, hasNotes ? styles.chipOn : styles.chipOff, pressed && styles.pressed]}>
      <Text style={[styles.chipText, hasNotes ? styles.chipTextOn : styles.chipTextOff]}>
        {hasNotes ? '✓ Notes' : 'No notes'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  headText: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingHorizontal: 4 },
  title: typo.heading,
  meta: { fontSize: 12, color: T.muted },
  headActions: { flexDirection: 'row', gap: 12 },
  result: { fontSize: 13, fontWeight: '600', color: T.accentDark, backgroundColor: T.accentSoft, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, overflow: 'hidden' },
  textBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  textBtnLabel: { fontSize: 17, fontWeight: '600', color: T.accent },

  list: { backgroundColor: T.surface, borderWidth: 1, borderColor: 'transparent', borderRadius: radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 9, paddingHorizontal: 14 },
  divider: { borderBottomWidth: 1, borderBottomColor: T.lineSoft },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { backgroundColor: T.accent },
  dotOff: { borderWidth: 1.5, borderColor: T.lineStrong },
  rowText: { flex: 1, gap: 1 },
  name: { fontSize: 15, fontWeight: '600', color: T.ink },

  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, minWidth: 74, alignItems: 'center' },
  chipOn: { backgroundColor: T.accentSoft },
  chipOff: { borderWidth: 1, borderStyle: 'dashed', borderColor: T.lineStrong },
  chipText: { fontSize: 12, fontWeight: '600' },
  chipTextOn: { color: T.accentDark },
  chipTextOff: { color: T.muted },

  remove: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 6 },
  removeText: { fontSize: 13, fontWeight: '600', color: T.urgent },

  empty: { backgroundColor: T.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: T.lineStrong, borderRadius: radius.lg, padding: 16, gap: 4 },
  addRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    minHeight: 44,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    fontSize: 15,
    color: T.ink,
  },
  addBtn: { minHeight: 44, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: 15, fontWeight: '600', color: T.onAccent },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  hint: { fontSize: 12, lineHeight: 17, color: T.muted, paddingHorizontal: 4 },
});
