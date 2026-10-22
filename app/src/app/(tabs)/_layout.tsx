import { Tabs } from 'expo-router/tabs';
import { SymbolView } from 'expo-symbols';
import { Platform, useWindowDimensions } from 'react-native';

import { T, WIDE } from '@/constants/trajectory';
import { TodayProvider } from '@/lib/today';

export default function TabLayout() {
  // Wide screens get a side rail instead of a bar stretched across the bottom.
  const wide = useWindowDimensions().width >= WIDE;
  return (
    // One timer and plan for Today and Study, kept running whichever tab is open.
    <TodayProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: T.accent,
          tabBarInactiveTintColor: T.muted,
          tabBarPosition: wide ? 'left' : 'bottom',
          tabBarVariant: wide ? 'material' : 'uikit',
          // The web tab bar's default height clips its labels.
          tabBarStyle: [{ backgroundColor: T.surface, borderTopColor: T.line }, !wide && Platform.OS === 'web' && { height: 68, paddingTop: 6, paddingBottom: 6 }, wide && { width: 208, minWidth: 208, maxWidth: 208, borderRightColor: T.line, paddingTop: 24, paddingHorizontal: 8 }],
          tabBarLabelStyle: { fontSize: wide ? 15 : 11, lineHeight: wide ? 20 : 16, fontWeight: '600', flexShrink: 0 },
          sceneStyle: { backgroundColor: T.ground },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Today',
            tabBarIcon: ({ color }) => (
              <SymbolView name={{ ios: 'sun.max', android: 'wb_sunny', web: 'wb_sunny' }} tintColor={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="study"
          options={{
            title: 'Study',
            tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'timer', android: 'timer', web: 'timer' }} tintColor={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="courses"
          options={{
            title: 'Courses',
            tabBarIcon: ({ color }) => (
              <SymbolView name={{ ios: 'book.closed', android: 'menu_book', web: 'menu_book' }} tintColor={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => (
              <SymbolView name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} tintColor={color} size={24} />
            ),
          }}
        />
      </Tabs>
    </TodayProvider>
  );
}
