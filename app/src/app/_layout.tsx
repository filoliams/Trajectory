import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { SyncStatus } from '@/components/sync-status';
import { T } from '@/constants/trajectory';
import { StoreProvider, useStore } from '@/lib/store';

export default function RootLayout() {
  return (
    <StoreProvider>
      <StatusBar style="light" />
      <Routes />
      <SyncStatus />
    </StoreProvider>
  );
}

function Routes() {
  const { authReady, session, profile } = useStore();
  const signedIn = !!session;
  const profileLoaded = !!profile;

  // Wait until we know whether you're signed in (and, if so, whether you've finished onboarding).
  if (!authReady || (signedIn && !profileLoaded)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={T.ink} />
      </View>
    );
  }

  const onboarded = !!profile?.onboarded;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.ground } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="course/[code]" />
        <Stack.Screen name="course/add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="course/manage" options={{ presentation: 'modal' }} />
        <Stack.Screen name="assessment/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="assessment/new" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.ground },
});
