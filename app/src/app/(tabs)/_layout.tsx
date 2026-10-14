import { Tabs } from 'expo-router/tabs';
import { SymbolView } from 'expo-symbols';

import { T } from '@/constants/trajectory';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: T.accent,
        tabBarInactiveTintColor: T.muted,
        tabBarStyle: { backgroundColor: T.surface, borderTopColor: T.line },
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
    </Tabs>
  );
}
