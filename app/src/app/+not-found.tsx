import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/form';
import { T, monoBold, typo } from '@/constants/trajectory';

export default function NotFoundScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.code}>404</Text>
        <Text style={styles.title}>This page is off the path</Text>
        <Text style={styles.body}>The link may be out of date, or the course or assessment it pointed to was removed.</Text>
        <Button title="Back to Today" onPress={() => router.replace('/')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.ground },
  content: { flex: 1, justifyContent: 'center', gap: 14, padding: 24, maxWidth: 480, width: '100%', alignSelf: 'center' },
  code: { fontFamily: monoBold, fontSize: 64, color: T.accent, letterSpacing: -2 },
  title: typo.display,
  body: { fontSize: 16, lineHeight: 23, color: T.muted, marginBottom: 8 },
});
