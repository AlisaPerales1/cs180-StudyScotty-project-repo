
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
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
          name="spots/[id]/reviews"
          options={{ href: null }}
        />
      </Tabs>
    </>
  );
}
