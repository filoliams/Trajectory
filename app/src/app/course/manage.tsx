import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button, ConfirmDelete, ErrorText, Field } from '@/components/form';
import { Sheet } from '@/components/sheet';
import { T } from '@/constants/trajectory';
import { useStore } from '@/lib/store';

export default function ManageCourseScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { courses, updateCourse, deleteCourse } = useStore();
  const course = courses.find((c) => c.code === code);
  const [name, setName] = useState(course?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!course) {
    return (
      <Sheet title="Course">
        <Text style={styles.body}>This course no longer exists.</Text>
      </Sheet>
    );
  }

  async function save() {
    if (!course) return;
    setBusy(true);
    setError(null);
    try {
      await updateCourse(course.id, { name: name.trim() });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={`Edit ${course.code}`}>
      <Field label="Course name" value={name} onChangeText={setName} />
      <ErrorText>{error}</ErrorText>
      <Button title="Save" onPress={save} loading={busy} />
      <Text style={styles.danger}>
        Removing the course also deletes its {course.assessments.length} assessment
        {course.assessments.length === 1 ? '' : 's'}.
      </Text>
      <ConfirmDelete
        label={`Remove ${course.code}`}
        onConfirm={async () => {
          await deleteCourse(course.id);
          router.dismissTo('/courses');
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, color: T.muted },
  danger: { fontSize: 13, color: T.muted, marginTop: 16 },
});
