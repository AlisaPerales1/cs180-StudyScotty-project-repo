import { Link, useLocalSearchParams } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getReportSessions, REPORTER_ID, REPORT_USERS, reportUsername, submitReport, subscribeReports } from '../api/reports';
import ActionButton from '../components/ActionButton';
import Screen from '../components/Screen';

export default function ReportScreen() {
  const { session_id } = useLocalSearchParams();
  const sessionId = session_id === undefined ? null : Number(session_id);
  return <ReportForm key={String(sessionId)} sessionId={sessionId} />;
}

/** @param {{ sessionId: number | null }} props */
function ReportForm({ sessionId }) {
  const sessions = useSyncExternalStore(subscribeReports, getReportSessions, getReportSessions);
  const isSession = sessionId !== null;
  const session = sessions.find((entry) => entry.id === sessionId);
  const [target, setTarget] = useState(43);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [message, setMessage] = useState('');

  function submit() {
    try {
      const report = submitReport({ target_id: isSession ? sessionId : target, target_type: isSession ? 'session' : 'user', reason, details });
      setMessage(`Demo report #${report.id} submitted for review.`);
      setReason('');
      setDetails('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit the report.');
    }
  }

  return (
    <Screen title={isSession ? 'Report a session' : 'Report a user'} subtitle="Help keep study spaces welcoming.">
      <Link href={isSession ? '/sessions' : '/profile'} style={styles.link}>{isSession ? 'Back to Study Circles' : 'Back to profile'}</Link>
      <Text style={styles.muted}>Mock demo · Reporting as @{reportUsername(REPORTER_ID)}. Reports reset on app reload.</Text>
      <View style={styles.card}>
        <Text style={styles.heading}>{isSession ? `Session: ${session?.title || 'Not found'}` : 'Who are you reporting?'}</Text>
        {isSession ? <Text style={styles.muted}>A report goes to admin review and does not automatically cancel the session.</Text> : null}
        {!isSession && REPORT_USERS.filter((user) => user.id !== REPORTER_ID).map((user) => (
          <Pressable key={user.id} accessibilityRole="radio" accessibilityState={{ checked: target === user.id }}
            onPress={() => { setTarget(user.id); setMessage(''); }} style={[styles.option, target === user.id && styles.selected]}>
            <Text style={styles.link}>@{user.username}</Text>
          </Pressable>
        ))}
        <Text style={styles.heading}>Reason (required)</Text>
        <TextInput accessibilityLabel="Report reason" placeholder={isSession ? 'Why are you reporting this session?' : 'Why are you reporting this user?'} value={reason}
          onChangeText={(value) => { setReason(value); setMessage(''); }} maxLength={100} style={styles.input} />
        <Text style={styles.heading}>Additional context (optional)</Text>
        <TextInput accessibilityLabel="Report details" placeholder="Describe what happened, including the study session if relevant."
          value={details} onChangeText={setDetails} multiline maxLength={2000} style={[styles.input, styles.details]} />
        <ActionButton title="Submit demo report" onPress={submit} disabled={isSession && (!session || session.status === 'cancelled')} />
        {isSession && session?.status === 'cancelled' ? <Text style={styles.muted}>This session has been cancelled.</Text> : null}
      </View>
      {message ? <Text accessibilityLiveRegion="polite" style={styles.link}>{message}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 14, backgroundColor: 'white', borderRadius: 16 },
  heading: { fontSize: 16, fontWeight: '600', color: '#142d4e' },
  muted: { color: '#526277', lineHeight: 22 },
  link: { color: '#2463a0', fontSize: 16 },
  option: { padding: 14, borderWidth: 1, borderColor: '#cfd8e3', borderRadius: 10 },
  selected: { borderColor: '#2463a0', backgroundColor: '#eaf1f9' },
  input: { borderWidth: 1, borderColor: '#cfd8e3', borderRadius: 10, padding: 12, fontSize: 16, color: '#142d4e' },
  details: { minHeight: 100, textAlignVertical: 'top' },
});
