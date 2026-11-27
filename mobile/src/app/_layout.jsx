
import { useEffect } from 'react';
import { Tabs, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { configureNotifications } from '../lib/reminders';
import { getAccessToken } from '../api/tokenStorage';

configureNotifications();

// SDK 58 redirects away from href: null tabs. Hide only the button so these
// routes remain reachable through redirects, links, and programmatic navigation.
/** @type {import('expo-router/js-tabs').TabsScreenOptions} */
const hiddenTabOptions = {
  tabBarButton: () => null,
  tabBarItemStyle: { display: 'none' },
};

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
        id="root"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#2463a0',
        }}
      >
        <Tabs.Screen name="index" options={hiddenTabOptions} />
        <Tabs.Screen name="link-google" options={hiddenTabOptions} />
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
            ...hiddenTabOptions,
            tabBarStyle: { display: 'none' },
          }}
        />

        <Tabs.Screen
          name="signup"
          options={{
            ...hiddenTabOptions,
            tabBarStyle: { display: 'none' },
          }}
        />

        <Tabs.Screen
          name="spots/[id]/index"
          options={hiddenTabOptions}
        />

        <Tabs.Screen
          name="spots/[id]/reviews"
          options={hiddenTabOptions}
        />
      </Tabs>
    </>
  );
}
