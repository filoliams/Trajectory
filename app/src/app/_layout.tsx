import { Geist_600SemiBold, Geist_700Bold, Geist_800ExtraBold, useFonts } from '@expo-google-fonts/geist';
import { GeistMono_600SemiBold, GeistMono_700Bold } from '@expo-google-fonts/geist-mono';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { SyncStatus } from '@/components/sync-status';
import { T } from '@/constants/trajectory';
import { StoreProvider, useStore } from '@/lib/store';

import '@/global.css';

export default function RootLayout() {
  return (
    <StoreProvider>
      <Head>
        <title>Trajectory</title>
      </Head>
      <StatusBar style="light" />
      <Routes />
      <SyncStatus />
      {/* Where components/ui menus, popovers and tooltips render. */}
      <PortalHost />
    </StoreProvider>
  );
}

function Routes() {
  const { authReady, session, profile } = useStore();
  // A font that fails to load falls back to the system face rather than blocking the app.
  const [fontsLoaded, fontError] = useFonts({
    Geist_600SemiBold,
    Geist_700Bold,
    Geist_800ExtraBold,
    GeistMono_600SemiBold,
    GeistMono_700Bold,
  });
  const signedIn = !!session;
  const profileLoaded = !!profile;

  // Wait until we know whether you're signed in (and, if so, whether you've finished onboarding).
  if (!authReady || (signedIn && !profileLoaded) || !(fontsLoaded || fontError)) {
    return (
      <View style={styles.loading} accessibilityLabel="Loading Trajectory">
        <Text style={styles.wordmark}>Trajectory</Text>
        <LoadingDot />
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

/** Breathing lime dot under the wordmark while the app starts. */
function LoadingDot() {
  const pulse = useSharedValue(0.3);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }),
      -1,
      true,
    );
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value, transform: [{ scale: 0.8 + pulse.value * 0.4 }] }));
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, backgroundColor: T.ground },
  wordmark: { fontSize: 28, fontWeight: '800', color: T.ink, letterSpacing: -1 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.accent },
});
