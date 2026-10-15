import { useEffect, useState } from 'react';
import { Button, Text, View } from 'react-native';
import { getHealth } from '../api/client';
import Screen from '../components/Screen';

export default function ProfileScreen() {
  const [status, setStatus] = useState('Checking connection…');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    getHealth()
      .then((health) => {
        if (active) setStatus(health.status === 'ok' ? 'Connected to StudyScotty' : 'Unexpected API response');
      })
      .catch(() => {
        if (active) setStatus('Unable to connect. Check your API URL and that the backend is running.');
      });
    return () => { active = false; };
  }, [attempt]);

  return (
    <Screen title="Your study space" subtitle="Your profile, courses, and favorite places will live here.">
      <Text>Sign-in and UCR email verification are coming next.</Text>
      <View style={{ padding: 20, gap: 12, backgroundColor: 'white', borderRadius: 16 }}>
        <Text accessibilityLiveRegion="polite">{status}</Text>
        <Button title="Check connection" onPress={() => {
          setStatus('Checking connection…');
          setAttempt((value) => value + 1);
        }} />
      </View>
    </Screen>
  );
}
