import { Link } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getReportSessions, reportUsername, subscribeReports } from '../api/reports';
import Screen from '../components/Screen';

export default function SessionsScreen() {
  const sessions = useSyncExternalStore(subscribeReports, getReportSessions, getReportSessions);
  return (
    <Screen title="Study Circles" subtitle="A little company for your next study session.">
      <Text>Mock sessions · Session creation, RSVPs, and check-ins are coming next. Changes reset on reload.</Text>
      {sessions.map((session) => (
        <View key={session.id} style={styles.card}>
          <Text style={styles.heading}>{session.title}</Text>
          <Text>Hosted by @{reportUsername(session.host_id)} · {session.status}</Text>
          {session.status === 'cancelled' ? <Text>Cancelled by an admin. This session is no longer available.</Text> : (
            <Link href={{ pathname: '/report', params: { session_id: session.id } }} style={styles.link}>Report session</Link>
          )}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 12, backgroundColor: 'white', borderRadius: 16 },
  heading: { fontSize: 17, fontWeight: '700', color: '#142d4e' },
  link: { color: '#2463a0', fontSize: 16 },
});
