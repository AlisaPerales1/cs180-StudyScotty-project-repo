import { useEffect, useState } from 'react';
import { Button, Text, View } from 'react-native';
import { getHealth } from '../api/client';

export default function ConnectionStatus() {
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
    <View style={{ padding: 20, gap: 12, backgroundColor: 'white', borderRadius: 16 }}>
      <Text accessibilityLiveRegion="polite">{status}</Text>
      <Button title="Check connection" onPress={() => {
        setStatus('Checking connection…');
        setAttempt((value) => value + 1);
      }} />
    </View>
  );
}
