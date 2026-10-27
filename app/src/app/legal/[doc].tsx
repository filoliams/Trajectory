import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/form';
import { Text } from '@/components/ui/text';
import { LEGAL_DOCS, LEGAL_UPDATED, legalDoc } from '@/lib/legal';

/** Privacy Policy, Terms of Use or Data Consent. Open signed in or out, so sign-up can link here. */
export default function LegalScreen() {
  const { doc: slug } = useLocalSearchParams<{ doc: string }>();
  const doc = legalDoc(slug ?? '');

  // Opened straight from a link (e.g. on the web) there's nothing to go back to.
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      <ScrollView contentContainerClassName="w-full max-w-[720px] self-center gap-5 px-4 pb-10 pt-3">
        <View className="flex-row justify-end">
          <Button title="Done" variant="secondary" onPress={close} />
        </View>

        {doc ? (
          <>
            <View className="gap-2 px-1">
              <Text className="font-display text-[38px] leading-[42px] tracking-tighter">{doc.title}</Text>
              <Text className="text-muted-foreground text-[13px]">Last updated {LEGAL_UPDATED}</Text>
            </View>
            <View className="bg-card border-border rounded-2xl border p-4">
              <Text className="text-[15px] leading-[22px]">{doc.summary}</Text>
            </View>

            {doc.sections.map((s) => (
              <View key={s.heading} className="gap-2 px-1">
                <Text className="text-[18px] font-semibold">{s.heading}</Text>
                {s.paragraphs?.map((p) => (
                  <Text key={p} className="text-muted-foreground text-[15px] leading-[22px]">
                    {p}
                  </Text>
                ))}
                {s.bullets?.map((b) => (
                  <View key={b} className="flex-row gap-2 pl-1">
                    <Text className="text-muted-foreground text-[15px] leading-[22px]">•</Text>
                    <Text className="text-muted-foreground flex-1 text-[15px] leading-[22px]">{b}</Text>
                  </View>
                ))}
              </View>
            ))}

            <View className="border-border flex-row flex-wrap gap-x-5 gap-y-2 border-t px-1 pt-4">
              {LEGAL_DOCS.filter((d) => d.slug !== doc.slug).map((d) => (
                <Pressable key={d.slug} accessibilityRole="link" onPress={() => router.setParams({ doc: d.slug })}>
                  <Text className="text-primary text-[15px] font-semibold">{d.title}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <Text className="text-muted-foreground px-1 text-[15px]">That page doesn't exist.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
