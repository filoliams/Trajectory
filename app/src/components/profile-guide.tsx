import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { T, radius } from '@/constants/trajectory';
import type { University } from '@/constants/universities';

/** A short numbered guide to downloading a course profile from the university's site. */
export function ProfileGuide({ university, semesterLabel }: { university: University; semesterLabel: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>How to download your {university.profileName}</Text>
      {university.guide(semesterLabel).map((step, i) => (
        <View key={step.title} style={styles.step}>
          <View style={styles.num}>
            <Text style={styles.numText}>{i + 1}</Text>
          </View>
          <View style={styles.stepMain}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepBody}>{step.body}</Text>
            {step.link ? (
              <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(step.link!.url)}>
                <Text style={styles.link}>{step.link.label}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
      {university.guideTip ? <Text style={styles.tip}>{university.guideTip}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: radius.lg, padding: 16 },
  title: { fontSize: 15, fontWeight: '700', color: T.ink },
  step: { flexDirection: 'row', gap: 10 },
  num: { width: 22, height: 22, borderRadius: 11, backgroundColor: T.accentSoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  numText: { fontSize: 12, fontWeight: '700', color: T.accentDark },
  stepMain: { flex: 1, gap: 2 },
  stepTitle: { fontSize: 14, fontWeight: '600', color: T.ink },
  stepBody: { fontSize: 13, lineHeight: 19, color: T.inkSoft },
  link: { fontSize: 13, fontWeight: '600', color: T.accent, paddingVertical: 4 },
  tip: { fontSize: 12, lineHeight: 17, color: T.muted, borderTopWidth: 1, borderTopColor: T.lineSoft, paddingTop: 10 },
});
