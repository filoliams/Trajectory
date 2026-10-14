import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { AssessmentForm } from '@/components/assessment-form';
import { Sheet } from '@/components/sheet';
import { T } from '@/constants/trajectory';
import { useStore } from '@/lib/store';

export default function NewAssessmentScreen() {
  const { course: code } = useLocalSearchParams<{ course: string }>();
  const { courses, addAssessment } = useStore();
  const course = courses.find((c) => c.code === code);

  if (!course) {
    return (
      <Sheet title="New assessment">
        <Text style={styles.body}>Course not found.</Text>
      </Sheet>
    );
  }

  return (
    <Sheet title={`New ${course.code} assessment`}>
      <AssessmentForm
        onSave={async (input) => {
          await addAssessment(course.id, input);
          router.back();
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, color: T.muted },
});
