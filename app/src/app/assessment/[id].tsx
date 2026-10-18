import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { AssessmentForm } from '@/components/assessment-form';
import { Sheet } from '@/components/sheet';
import { T } from '@/constants/trajectory';
import { useStore } from '@/lib/store';

export default function EditAssessmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { courses, updateAssessment, deleteAssessment } = useStore();
  const course = courses.find((c) => c.assessments.some((a) => a.id === id));
  const assessment = course?.assessments.find((a) => a.id === id);

  if (!course || !assessment) {
    return (
      <Sheet title="Assessment">
        <Text style={styles.body}>This assessment no longer exists.</Text>
      </Sheet>
    );
  }

  return (
    <Sheet title={`Edit ${course.code} assessment`}>
      <AssessmentForm
        initial={assessment}
        onSave={async (input) => {
          await updateAssessment(assessment.id, input);
          router.back();
        }}
        onDelete={async () => {
          await deleteAssessment(assessment.id);
          router.back();
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, color: T.muted },
});
