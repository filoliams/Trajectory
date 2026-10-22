import type { ReactNode } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorText, Segmented } from '@/components/form';
import { Text } from '@/components/ui/text';
import { CURRENT_YEAR } from '@/config';
import { T, WIDE } from '@/constants/trajectory';
import { DAILY_HOURS_OPTIONS, useDailyHours } from '@/lib/daily-hours';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export default function SettingsScreen() {
  const { profile, session, setSemester, signOut, error, online, pendingCount } = useStore();
  const [hours, setHours] = useDailyHours();
  const wide = useWindowDimensions().width >= WIDE;

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView contentContainerClassName={cn('w-full self-center gap-5 px-4 pb-10 pt-3', wide ? 'max-w-[1100px] px-10 pt-7' : 'max-w-[720px]')}>
        <Text className="font-display px-1 text-[44px] leading-[48px] tracking-tighter">
          Your <Text className="font-serif text-[48px] text-primary">settings</Text>
        </Text>

        <View className="flex-row flex-wrap gap-4">
          <Section index={0} title="Study plan" hint="Today's plan fits into this. Courses with fewer topics covered in your notes get more of it.">
            <Segmented
              label="Study time each day"
              options={DAILY_HOURS_OPTIONS.map((h) => ({ value: String(h), label: `${h}h` }))}
              value={String(hours)}
              onChange={(v) => setHours(Number(v))}
            />
          </Section>

          <Section index={1} title="Semester" hint="Switching shows that semester's courses. Nothing is deleted.">
            <Segmented
              options={[
                { value: `${CURRENT_YEAR} S1`, label: `Sem 1, ${CURRENT_YEAR}` },
                { value: `${CURRENT_YEAR} S2`, label: `Sem 2, ${CURRENT_YEAR}` },
              ]}
              value={profile?.semester ?? `${CURRENT_YEAR} S2`}
              onChange={setSemester}
            />
            <ErrorText>{error}</ErrorText>
          </Section>

          <Section index={2} title="Account">
            <Row label="Signed in as" value={session?.user.email ?? ''} />
            <View className="flex-row items-center justify-between gap-3">
              <Text className="text-muted-foreground text-[15px]">Sync</Text>
              <View className="flex-shrink flex-row items-center gap-2">
                <View className="h-2 w-2 rounded-full" style={{ backgroundColor: !online ? T.warn : pendingCount ? T.accent : T.done }} />
                <Text className="flex-shrink text-[15px] font-semibold" numberOfLines={1}>
                  {syncLabel(online, pendingCount)}
                </Text>
              </View>
            </View>
            <Button title="Sign out" variant="secondary" onPress={signOut} />
          </Section>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function syncLabel(online: boolean, pendingCount: number): string {
  if (!online) return 'Offline — changes save when you reconnect';
  if (pendingCount) return `${pendingCount} change(s) saving…`;
  return 'Up to date';
}

function Section({ title, hint, index, children }: { title: string; hint?: string; index: number; children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(18)} style={{ flexGrow: 1, flexBasis: 320, gap: 8 }}>
      <Text className="text-muted-foreground px-1 text-xs font-semibold uppercase tracking-wider">{title}</Text>
      <View className="bg-card border-border gap-3.5 rounded-2xl border p-4">{children}</View>
      {hint ? <Text className="text-muted-foreground px-1 text-[13px] leading-[18px]">{hint}</Text> : null}
    </Animated.View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="text-muted-foreground text-[15px]">{label}</Text>
      <Text className="flex-shrink text-[15px] font-semibold" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
