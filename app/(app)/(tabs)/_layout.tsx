import { Tabs } from 'expo-router';
import React from 'react';
import { Easing } from 'react-native';

import { FloatingGlassTabBar } from '@/components/navigation/floating-glass-tab-bar';
import { useAppTheme } from '@/context/theme-context';

export default function TabLayout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      tabBar={(props) => <FloatingGlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        transitionSpec: {
          animation: 'timing',
          config: {
            duration: 240,
            easing: Easing.out(Easing.cubic),
          },
        },
        sceneStyle: { backgroundColor: colors.background },
        lazy: true,
        freezeOnBlur: false,
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="cards" options={{ title: 'Cards' }} />
      <Tabs.Screen name="services" options={{ title: 'Services' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
