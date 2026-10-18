import { Tabs } from 'expo-router/tabs';
import { SymbolView } from 'expo-symbols';
import { Platform } from 'react-native';

import { T } from '@/constants/trajectory';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: T.accent,
        tabBarInactiveTintColor: T.muted,
        // The web tab bar's default height clips its labels.
        tabBarStyle: [{ backgroundColor: T.surface, borderTopColor: T.line }, Platform.OS === 'web' && { height: 68, paddingTop: 6, paddingBottom: 6 }],
        tabBarLabelStyle: { fontSize: 11, lineHeight: 16, fontWeight: '600', flexShrink: 0 },
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
  );
}
