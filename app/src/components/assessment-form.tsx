import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Button, ConfirmDelete, ErrorText, Field, Segmented } from '@/components/form';
import { T } from '@/constants/trajectory';
import type { Assessment, AssessmentType, Status } from '@/data/courses';
import type { AssessmentInput } from '@/lib/store';

const BRISBANE_OFFSET_MS = 10 * 3_600_000; // Queensland has no daylight saving

/** ISO → { date: "16/10/2026", time: "16:00" } in Brisbane time. */
function splitDue(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(new Date(iso).getTime() + BRISBANE_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

/** "16/10/2026" + "4:00 pm" or "16:00" → ISO with +10:00, or an error message. */
function joinDue(date: string, time: string): { iso: string | null; error?: string } {
  if (!date.trim()) return { iso: null };
  const dm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date.trim());
  if (!dm) return { iso: null, error: 'Write the date as DD/MM/YYYY, e.g. 16/10/2026.' };
  let hour = 23;
  let minute = 59;
  if (time.trim()) {
    const tm = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(time.trim());
    if (!tm) return { iso: null, error: 'Write the time like 16:00 or 4:00 pm.' };
    hour = Number(tm[1]);
    minute = Number(tm[2] ?? 0);
    if (tm[3]) hour = (hour % 12) + (tm[3].toLowerCase() === 'pm' ? 12 : 0);
    if (hour > 23 || minute > 59) return { iso: null, error: 'That time doesn’t exist.' };
  }
  const [d, m, y] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCDate() !== d || check.getUTCMonth() !== m - 1) return { iso: null, error: 'That date doesn’t exist.' };
  const pad = (n: number) => String(n).padStart(2, '0');
  return { iso: `${y}-${pad(m)}-${pad(d)}T${pad(hour)}:${pad(minute)}:00+10:00` };
}

const TYPES: { value: AssessmentType; label: string }[] = [
  { value: 'assignment', label: 'Assignment' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'exam', label: 'Exam' },
  { value: 'other', label: 'Other' },
];

const STATUSES: { value: Status; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

type Props = {
  initial?: Assessment;
  onSave: (input: AssessmentInput) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function AssessmentForm({ initial, onSave, onDelete }: Props) {
  const due = splitDue(initial?.due ?? null);
  const [name, setName] = useState(initial?.name ?? '');
  const [date, setDate] = useState(due.date);
  const [time, setTime] = useState(due.time);
  const [weight, setWeight] = useState(initial ? String(initial.weight) : '');
  const [hours, setHours] = useState(initial ? String(initial.hoursLeft) : '');
  const [type, setType] = useState<AssessmentType>(initial?.type ?? 'assignment');
  const [status, setStatus] = useState<Status>(initial?.status ?? 'not_started');
  const [isHurdle, setIsHurdle] = useState(initial?.isHurdle ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!name.trim()) return setError('Give it a name.');
    const parsed = joinDue(date, time);
    if (parsed.error) return setError(parsed.error);
    const w = weight.trim() === '' ? 0 : Number(weight);
    if (Number.isNaN(w) || w < 0 || w > 100) return setError('Weighting should be a number from 0 to 100.');
    const h = hours.trim() === '' ? null : Number(hours);
    if (h !== null && (Number.isNaN(h) || h < 0)) return setError('Hours should be a number.');
    setBusy(true);
    try {
      await onSave({ name, due: parsed.iso, weight: w, type, status, hours: h, isHurdle });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      {initial?.needsReview ? (
        <View style={styles.review}>
          <Text style={styles.reviewTitle}>Check this one</Text>
          <Text style={styles.reviewText}>{initial.note ?? 'The importer wasn’t sure about this item.'}</Text>
          <Text style={styles.reviewText}>Saving marks it as checked.</Text>
        </View>
      ) : null}

      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Problem Set" />
      <View style={styles.row}>
        <View style={styles.grow}>
          <Field label="Due date" value={date} onChangeText={setDate} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" />
        </View>
        <View style={styles.time}>
          <Field label="Time" value={time} onChangeText={setTime} placeholder="16:00" keyboardType="numbers-and-punctuation" />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.grow}>
          <Field label="Weighting (%)" value={weight} onChangeText={setWeight} placeholder="25" keyboardType="decimal-pad" />
        </View>
        <View style={styles.grow}>
          <Field label="Hours left" value={hours} onChangeText={setHours} placeholder="Estimate" keyboardType="decimal-pad" />
        </View>
      </View>
      <Segmented label="Type" options={TYPES} value={type} onChange={setType} />
      <Segmented label="Status" options={STATUSES} value={status} onChange={setStatus} />
      <View style={styles.switchRow}>
        <View style={styles.grow}>
          <Text style={styles.switchLabel}>Hurdle</Text>
          <Text style={styles.switchHint}>You must pass this to pass the course.</Text>
        </View>
        <Switch value={isHurdle} onValueChange={setIsHurdle} trackColor={{ true: T.accent, false: T.track }} />
      </View>

      <ErrorText>{error}</ErrorText>
      <Button title="Save" onPress={save} loading={busy} />
      {onDelete ? <ConfirmDelete label="Delete assessment" onConfirm={onDelete} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  row: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
  time: { width: 110 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  switchLabel: { fontSize: 13, fontWeight: '600', color: T.ink },
  switchHint: { fontSize: 12, color: T.muted },
  review: { backgroundColor: T.warnSoft, borderRadius: 14, padding: 14, gap: 4 },
  reviewTitle: { fontSize: 15, fontWeight: '700', color: T.warn },
  reviewText: { fontSize: 13, lineHeight: 19, color: T.inkSoft },
});
