
import { useEffect } from 'react';
import { Tabs, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { configureNotifications } from '../lib/reminders';
import { getAccessToken } from '../api/tokenStorage';

configureNotifications();

export default function RootLayout() {
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    if (!['/', '/login', '/signup'].includes(pathname)) {
      getAccessToken().then((token) => {
        if (active && !token) router.replace('/login');
      }).catch(() => {
        if (active) router.replace('/login');
      });
    }
    return () => { active = false; };
  }, [pathname]);

  return (
    <>
      <StatusBar style="dark" />

      <Tabs
        initialRouteName="login"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#2463a0',
        }}
      >
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="link-google" options={{ href: null }} />
        <Tabs.Screen
          name="discovery"
          options={{ title: 'Discovery' }}
        />

        <Tabs.Screen
          name="sessions"
          options={{ title: 'Study Circles' }}
        />

        <Tabs.Screen
          name="profile"
          options={{ title: 'Profile' }}
        />

        <Tabs.Screen
          name="admin"
          options={{ title: 'Admin demo' }}
        />

        <Tabs.Screen
          name="login"
          options={{
            href: null,
            tabBarStyle: { display: 'none' },
          }}
        />

        <Tabs.Screen
          name="signup"
          options={{
            href: null,
            tabBarStyle: { display: 'none' },
          }}
        />

        <Tabs.Screen
          name="spots/[id]/index"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="spots/[id]/reviews"
          options={{ href: null }}
        />
      </Tabs>
    </>
  );
}
