import * as DocumentPicker from 'expo-document-picker';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ConfidenceLine, CourseConfidence } from '@/components/confidence';
import { ErrorText } from '@/components/form';
import { QuizSheet } from '@/components/quiz-sheet';
import { T, mono, radius, typo } from '@/constants/trajectory';
import type { Course, Topic } from '@/data/courses';
import { importFromFile } from '@/lib/api';
import type { Understanding } from '@/lib/levels';
import { summariseNotes } from '@/lib/note-files';
import { analyseNotes } from '@/lib/note-sync';
import { coveredTopics } from '@/lib/notes-match';
import { topicConfidence } from '@/lib/confidence';
import { lastQuizLabel } from '@/lib/quiz';
import { parseSemester, useStore } from '@/lib/store';

const NOTE_EXT = /\.(md|markdown|txt)$/i;

/**
 * A course's topics in two steps: upload the semester's topics (from the course profile or typed in),
 * then upload notes, which the AI checks against those topics. Notes stay locked until there are topics.
 */
export function TopicList({ course }: { course: Course }) {
  const { addTopics, importTopics, setTopicNotes, deleteTopic, reload, profile, online } = useStore();
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<'choose' | 'type' | null>(null);
  const [typed, setTyped] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [typeError, setTypeError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'topics' | 'notes' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [openReason, setOpenReason] = useState<string | null>(null);
  const [quizTopic, setQuizTopic] = useState<Topic | null>(null);

  const topics = course.topics;
  const withNotes = topics.filter((t) => t.hasNotes).length;
  const noTopics = topics.length === 0;
  const draftName = draft.trim();
  const toSave = draftName && !isTaken(draftName) ? [...typed, draftName] : typed;

  function isTaken(name: string) {
    return [...topics.map((t) => t.name), ...typed].some((n) => n.toLowerCase() === name.toLowerCase());
  }

  function begin() {
    setError(null);
    setResult(null);
  }

  /** Add notes saved to Files (GoodNotes/OneNote: Share → Save to Files): AI levels per topic, word matching as the fallback. */
  async function addNotes() {
    begin();
    const picked = await DocumentPicker.getDocumentAsync({ multiple: true, type: '*/*', copyToCacheDirectory: true });
    if (picked.canceled) return;
    setBusy('notes');
    try {
      const lines: string[] = [];
      // Word matching first: it works offline, so Markdown/text notes count even if the analysis can't run.
      const files = picked.assets.filter((f) => NOTE_EXT.test(f.name));
      if (files.length) {
        const texts = await Promise.all(files.map((f) => (f.file ? f.file.text() : fetch(f.uri).then((r) => r.text()))));
        // File names often are the topic, e.g. "Hypothesis testing.md".
        const found = coveredTopics(
          topics.filter((t) => !t.hasNotes),
          [...texts, ...files.map((f) => f.name.replace(NOTE_EXT, ''))],
        );
        await Promise.all(found.map((t) => setTopicNotes(t.id, true)));
        if (found.length) lines.push(`Ticked ${found.length} topic${found.length === 1 ? '' : 's'} from your text notes.`);
      }
      try {
        lines.push(...summariseNotes(await analyseNotes(course.code, picked.assets)));
        await reload();
      } catch (e) {
        lines.push(`Deeper analysis didn’t run: ${e instanceof Error ? e.message : String(e)}`);
      }
      setResult(lines.join('\n'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  /** Topics from the course profile the student saved; UQ's site blocks fetching it for them. Assessments are left alone. */
  async function fromProfile() {
    setSheet(null);
    begin();
    const picked = await DocumentPicker.getDocumentAsync({ type: ['text/html', 'application/pdf'], copyToCacheDirectory: true });
    if (picked.canceled) return;
    const file = picked.assets[0];
    setBusy('topics');
    try {
      const { year, semester } = parseSemester(profile?.semester ?? '2026 S2');
      const imported = await importFromFile({ name: file.name, uri: file.uri, mimeType: file.mimeType, file: file.file }, year, semester);
      if (imported.code !== course.code) throw new Error(`That profile is for ${imported.code}, not ${course.code}. Upload ${course.code}’s profile instead.`);
      const listed = imported.topics ?? [];
      if (!listed.length) {
        throw new Error(
          'This profile doesn’t list weekly topics we can read. PDF profiles don’t include them yet: save the profile’s web page as .html and upload that, or type the topics in.',
        );
      }
      const added = await importTopics(course.id, listed);
      setResult(
        added
          ? `Added ${added} topic${added === 1 ? '' : 's'} from the ${course.code} course profile. Next, upload your notes.`
          : `All ${listed.length} topics in the profile are already here.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function openTyping() {
    setTyped([]);
    setDraft('');
    setTypeError(null);
    setSheet('type');
  }

  function queueTyped() {
    if (!draftName) return;
    if (isTaken(draftName)) return setTypeError(`"${draftName}" is already a topic.`);
    setTyped((list) => [...list, draftName]);
    setDraft('');
    setTypeError(null);
  }

  async function saveTyped() {
    if (!toSave.length) return;
    setSheet(null);
    begin();
    try {
      await addTopics(course.id, toSave);
      setResult(`Added ${toSave.length} topic${toSave.length === 1 ? '' : 's'}. Next, upload your notes.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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

  const notesHint = noTopics
    ? 'Add this course’s topics first.'
    : !online
      ? 'Connect to the internet to upload notes.'
      : 'PDFs, images, Markdown or text. The AI checks them against your topics.';

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
        {topics.length > 0 ? (
          <Pressable accessibilityRole="button" style={styles.textBtn} onPress={() => setEditing((e) => !e)}>
            <Text style={styles.textBtnLabel}>{editing ? 'Done' : 'Edit'}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.actions}>
        <StepButton
          step={1}
          icon="≡"
          title={busy === 'topics' ? 'Reading profile…' : 'Upload topics'}
          hint={noTopics ? 'From your course profile, or type them in.' : `${topics.length} topics. Add more from the profile or by hand.`}
          primary={noTopics}
          disabled={busy !== null}
          onPress={() => setSheet('choose')}
        />
        <StepButton
          step={2}
          icon="↑"
          title={busy === 'notes' ? 'Analysing…' : 'Upload notes'}
          hint={notesHint}
          primary={!noTopics}
          disabled={noTopics || !online || busy !== null}
          onPress={addNotes}
        />
      </View>

      {result ? <Text style={styles.result}>{result}</Text> : null}
      <ErrorText>{error}</ErrorText>

      {topics.length > 0 ? <CourseConfidence code={course.code} topics={topics} now={Date.now()} /> : null}

      {topics.length > 0 ? (
        <View style={styles.list}>
          {topics.map((t, i) => (
            <View key={t.id} style={[styles.row, i < topics.length - 1 && styles.divider]}>
              <View style={[styles.dot, t.hasNotes ? styles.dotOn : styles.dotOff]} />
              <View style={styles.rowText}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{t.name}</Text>
                  {t.understanding ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${UNDERSTANDING_LABEL[t.understanding]}. ${openReason === t.id ? 'Hide' : 'Show'} why`}
                      hitSlop={6}
                      onPress={() => setOpenReason((id) => (id === t.id ? null : t.id))}
                      style={[styles.level, levelStyles[t.understanding]]}>
                      <Text style={[styles.levelText, levelTextStyles[t.understanding]]}>{UNDERSTANDING_LABEL[t.understanding]}</Text>
                    </Pressable>
                  ) : null}
                </View>
                {t.week ? <Text style={styles.meta}>{t.week}</Text> : null}
                <ConfidenceLine topic={t} now={Date.now()} />
                {lastQuizLabel(t.quizzes, Date.now()) ? <Text style={styles.meta}>{lastQuizLabel(t.quizzes, Date.now())}</Text> : null}
                {openReason === t.id && t.understandingReason ? <Reason text={t.understandingReason} /> : null}
              </View>
              {editing ? (
                <Pressable accessibilityRole="button" onPress={() => remove(t)} style={styles.remove}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              ) : (
                <View style={styles.rowActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={online ? `Quiz me on ${t.name}` : 'Quiz me needs the internet'}
                    accessibilityState={{ disabled: !online }}
                    disabled={!online}
                    onPress={() => setQuizTopic(t)}
                    style={({ pressed }) => [styles.quizBtn, !online && styles.disabled, pressed && styles.pressed]}>
                    <Text style={styles.quizBtnText}>{t.quizzes?.length ? 'Quiz again' : 'Quiz me'}</Text>
                  </Pressable>
                  <NotesIndicator hasNotes={t.hasNotes} onPress={() => setTopicNotes(t.id, !t.hasNotes)} />
                </View>
              )}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.name}>No topics yet</Text>
          <EmptyStep n={1}>Upload topics: bring in the semester’s weekly topics from the course profile, or type them from your lecture schedule.</EmptyStep>
          <EmptyStep n={2}>Upload notes: the AI finds where each topic appears in your notes, then rates how well you’ve covered it.</EmptyStep>
        </View>
      )}
      {topics.length > 0 ? (
        <Text style={styles.hint}>
          Tap a level to see which pages it was based on. In GoodNotes or OneNote, use Share → Save to Files before uploading notes. Tap a
          notes marker to change it by hand.
        </Text>
      ) : null}

      {quizTopic ? (
        <QuizSheet
          topic={quizTopic}
          onClose={(done) => {
            if (done) {
              // The row updates from the store; this one line confirms the change. No result screen.
              const before = topicConfidence(quizTopic);
              const after = topicConfidence({ ...quizTopic, quizzes: [...(quizTopic.quizzes ?? []), { ...done, at: new Date().toISOString() }] });
              const d = after - before;
              setResult(`${quizTopic.name}: ${done.score}/${done.total}. Confidence ${after}% (${d > 0 ? `+${d}` : d < 0 ? d : 'no change'}).`);
            }
            setQuizTopic(null);
          }}
        />
      ) : null}

      <Popup visible={sheet === 'choose'} title="Upload topics" onClose={() => setSheet(null)}>
        <Text style={styles.sheetBody}>Choose how to add {course.code}’s topics for the semester.</Text>
        <Choice
          title="From course profile"
          body={
            online
              ? 'Upload the profile page you saved from the UQ course profile site. Only topics are added; your assessments stay as they are.'
              : 'Connect to the internet to read a profile.'
          }
          disabled={!online}
          onPress={fromProfile}
        />
        <Choice title="Type them in" body="Add topics one at a time from your lecture schedule." onPress={openTyping} />
      </Popup>

      <Popup visible={sheet === 'type'} title="Type them in" onClose={() => setSheet(null)}>
        <Text style={styles.sheetBody}>Press Enter after each topic. They’re added when you tap Save.</Text>
        <View style={styles.addRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="e.g. Hypothesis testing"
            placeholderTextColor={T.placeholder}
            accessibilityLabel="Topic name"
            style={styles.input}
            onSubmitEditing={queueTyped}
            submitBehavior="submit"
            returnKeyType="next"
            autoFocus
          />
          <Pressable
            accessibilityRole="button"
            disabled={!draftName}
            onPress={queueTyped}
            style={({ pressed }) => [styles.addBtn, !draftName && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>
        {typed.length ? (
          <View style={styles.typed}>
            {typed.map((n) => (
              <Text key={n} style={styles.typedTag}>
                {n}
              </Text>
            ))}
          </View>
        ) : null}
        <ErrorText>{typeError}</ErrorText>
        <Pressable
          accessibilityRole="button"
          disabled={!toSave.length}
          onPress={saveTyped}
          style={({ pressed }) => [styles.saveBtn, !toSave.length && styles.disabled, pressed && styles.pressed]}>
          <Text style={styles.addBtnText}>
            Save {toSave.length || ''} topic{toSave.length === 1 ? '' : 's'}
          </Text>
        </Pressable>
      </Popup>
    </View>
  );
}

/** One of the two steps; the step to do next is filled in. */
function StepButton(p: { step: number; icon: string; title: string; hint: string; primary: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Step ${p.step}: ${p.title}. ${p.hint}`}
      accessibilityState={{ disabled: p.disabled }}
      disabled={p.disabled}
      onPress={p.onPress}
      style={({ pressed }) => [styles.step, p.primary && styles.stepPrimary, p.disabled && styles.disabled, pressed && styles.pressed]}>
      <View style={[styles.stepIcon, p.primary && styles.stepIconPrimary]}>
        <Text style={[styles.stepIconText, p.primary && styles.onAccent]}>{p.icon}</Text>
      </View>
      <View style={styles.stepText}>
        <Text style={[styles.stepNo, p.primary && styles.onAccent]}>STEP {p.step}</Text>
        <Text style={[styles.stepTitle, p.primary && styles.onAccent]}>{p.title}</Text>
        <Text style={[styles.stepHint, p.primary && styles.stepHintPrimary]}>{p.hint}</Text>
      </View>
    </Pressable>
  );
}

function EmptyStep({ n, children }: { n: number; children: ReactNode }) {
  return (
    <View style={styles.emptyStep}>
      <Text style={styles.emptyStepNo}>{n}</Text>
      <Text style={styles.emptyStepText}>{children}</Text>
    </View>
  );
}

/** An analysis reason reads "pp. 12-15 · Explained with one example."; the location is set apart. */
function Reason({ text }: { text: string }) {
  const [where, ...rest] = text.split(' · ');
  return rest.length ? (
    <Text style={styles.reason}>
      <Text style={styles.where}>{where}</Text> · {rest.join(' · ')}
    </Text>
  ) : (
    <Text style={styles.reason}>{text}</Text>
  );
}

function Popup({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.scrim} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.sheetHead}>
            <Text style={styles.title}>{title}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.textBtn}>
              <Text style={styles.textBtnLabel}>Cancel</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Choice({ title, body, disabled, onPress }: { title: string; body: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, disabled && styles.disabled, pressed && styles.pressed]}>
      <Text style={styles.choiceTitle}>{title}</Text>
      <Text style={styles.meta}>{body}</Text>
    </Pressable>
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
  section: { gap: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  headText: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingHorizontal: 4 },
  title: typo.heading,
  meta: { fontSize: 12, color: T.muted },
  result: { fontSize: 13, fontWeight: '600', color: T.accentDark, backgroundColor: T.accentSoft, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, overflow: 'hidden' },
  textBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  textBtnLabel: { fontSize: 17, fontWeight: '600', color: T.accent },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  step: { flexGrow: 1, flexBasis: 220, flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 76, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface },
  stepPrimary: { backgroundColor: T.accent, borderColor: T.accent },
  stepIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: T.accentSoft },
  stepIconPrimary: { backgroundColor: 'rgba(11,11,15,0.12)' },
  stepIconText: { fontSize: 17, fontWeight: '700', color: T.accent },
  stepText: { flex: 1, gap: 2 },
  stepNo: { fontFamily: mono, fontSize: 11, letterSpacing: 0.6, color: T.muted },
  stepTitle: { fontSize: 15.5, fontWeight: '700', color: T.ink },
  stepHint: { fontSize: 13, color: T.muted },
  stepHintPrimary: { color: '#2C3410' },
  onAccent: { color: T.onAccent },

  list: { backgroundColor: T.surface, borderWidth: 1, borderColor: 'transparent', borderRadius: radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 9, paddingHorizontal: 14 },
  divider: { borderBottomWidth: 1, borderBottomColor: T.lineSoft },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { backgroundColor: T.accent },
  dotOff: { borderWidth: 1.5, borderColor: T.lineStrong },
  rowText: { flex: 1, gap: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  level: { borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  levelText: { fontSize: 11, fontWeight: '700' },
  reason: { fontSize: 13, lineHeight: 18, color: T.inkSoft, marginTop: 4 },
  where: { fontFamily: mono, fontSize: 12, color: T.accent },
  name: { fontSize: 15, fontWeight: '600', color: T.ink },

  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, minWidth: 74, alignItems: 'center' },
  chipOn: { backgroundColor: T.accentSoft },
  chipOff: { borderWidth: 1, borderStyle: 'dashed', borderColor: T.lineStrong },
  chipText: { fontSize: 12, fontWeight: '600' },
  chipTextOn: { color: T.accentDark },
  chipTextOff: { color: T.muted },

  rowActions: { alignItems: 'flex-end', gap: 6 },
  quizBtn: { minHeight: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
  quizBtnText: { fontSize: 12.5, fontWeight: '600', color: T.onAccent },
  remove: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 6 },
  removeText: { fontSize: 13, fontWeight: '600', color: T.urgent },

  empty: { backgroundColor: T.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: T.lineStrong, borderRadius: radius.lg, padding: 16, gap: 8 },
  emptyStep: { flexDirection: 'row', gap: 10 },
  emptyStepNo: { fontFamily: mono, fontSize: 13, color: T.accent },
  emptyStepText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: T.inkSoft },
  hint: { fontSize: 12, lineHeight: 17, color: T.muted, paddingHorizontal: 4 },

  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 520, maxHeight: '85%', backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: radius.lg, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 18 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetContent: { gap: 12 },
  sheetBody: { fontSize: 14, lineHeight: 20, color: T.muted },
  choice: { gap: 3, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: T.line, backgroundColor: T.ground },
  choiceTitle: { fontSize: 15, fontWeight: '700', color: T.accent },
  typed: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typedTag: { fontFamily: mono, fontSize: 12, color: T.ink, backgroundColor: T.elevated, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },

  addRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    minHeight: 44,
    backgroundColor: T.ground,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    fontSize: 15,
    color: T.ink,
  },
  addBtn: { minHeight: 44, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: 15, fontWeight: '600', color: T.onAccent },
  saveBtn: { minHeight: 44, borderRadius: 999, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
});

/** Labels and colours for a topic's analysed level, matching the course chip's scale. */
const UNDERSTANDING_LABEL: Record<Understanding, string> = { none: 'Not covered', weak: 'Weak', okay: 'Okay', strong: 'Strong' };

const levelStyles = StyleSheet.create({
  none: { borderWidth: 1, borderStyle: 'dashed', borderColor: T.lineStrong },
  weak: { backgroundColor: T.warnSoft },
  okay: { backgroundColor: T.neutralSoft },
  strong: { backgroundColor: T.accent },
});

const levelTextStyles = StyleSheet.create({
  none: { color: T.muted },
  weak: { color: T.warn },
  okay: { color: T.inkSoft },
  strong: { color: T.onAccent },
});
