import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { CourseAdder } from '@/components/course-adder';
import { Button } from '@/components/form';
import { Sheet } from '@/components/sheet';
import { T } from '@/constants/trajectory';

export default function AddCourseScreen() {
  return (
    <Sheet title="Add a course">
      <Text style={styles.body}>
        Type the course code and we'll import its assessments from the course profile. Adding a course you already have
        refreshes its imported assessments and keeps the ones you added yourself.
      </Text>
      <CourseAdder />
      <Button title="Done" variant="secondary" onPress={() => router.back()} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22, color: T.muted },
});
