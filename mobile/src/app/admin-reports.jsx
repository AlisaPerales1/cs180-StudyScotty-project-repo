import { Link } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getReports, getReportSessions, REPORT_STATUSES, REPORT_USERS, reportTarget, reportUsername, reviewSessionReport, subscribeReports } from '../api/reports';
import ActionButton from '../components/ActionButton';
import Screen from '../components/Screen';

export default function AdminReportsScreen() {
  const reports = useSyncExternalStore(subscribeReports, getReports, getReports);
  const [filter, setFilter] = useState('all');
  const [type, setType] = useState('all');
  const [note, setNote] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState(/** @type {number | null} */ (null));
  const visible = reports.filter((report) => (filter === 'all' || report.status === filter)
    && (type === 'all' || (report.target_type || 'user') === type));
  const selected = reports.find((report) => report.id === selectedId);
  const session = selected?.target_type === 'session' ? getReportSessions().find((entry) => entry.id === selected.target_id) : null;

  /** @param {'dismiss' | 'cancel_session'} action */
  function review(action) {
    try {
      reviewSessionReport(selectedId, action, note);
      setMessage(action === 'dismiss' ? 'Demo report dismissed.' : 'Demo session cancelled; its record and reports are preserved.');
      setConfirmCancel(false);
      setNote('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not review this report.');
    }
  }

  return (
    <Screen title="Report monitoring" subtitle="Review user-submitted reports.">
      <Link href="/admin" style={styles.link}>Back to account moderation</Link>
      <Text style={styles.muted}>Admin demo · Mock data, visible without sign-in. Counts are reports, not confirmed violations. Reviewed does not mean confirmed.</Text>
      {selected ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Report #{selected.id}</Text>
          <Text style={styles.status}>Status: {selected.status}</Text>
          <Text style={styles.text}>Reported {selected.target_type || 'user'}: {reportTarget(selected)}</Text>
          {session ? <Text style={styles.text}>Host: @{reportUsername(session.host_id)} · Session status: {session.status}</Text> : null}
          <Text style={styles.text}>Submitted by: @{reportUsername(selected.reporter_id)}</Text>
          <Text style={styles.muted}>{new Date(selected.created_at).toLocaleString()}</Text>
          <Text style={styles.heading}>Reason</Text>
          <Text style={styles.text}>{selected.reason}</Text>
          <Text style={styles.heading}>Context</Text>
          <Text style={styles.text}>{selected.details || 'No additional context provided.'}</Text>
          {selected.reviewed_at ? <Text style={styles.muted}>Reviewed by {selected.reviewed_by} · {new Date(selected.reviewed_at).toLocaleString()}{'\n'}Review reason: {selected.review_note}</Text> : null}
          {session?.cancelled_at ? <Text style={styles.muted}>Cancelled by {session.cancelled_by} · {new Date(session.cancelled_at).toLocaleString()}{'\n'}Cancellation reason: {session.cancellation_reason}</Text> : null}
          {session && selected.status === 'pending' ? (
            <>
              <Text style={styles.heading}>Review reason (required)</Text>
              <TextInput accessibilityLabel="Session report review reason" value={note} onChangeText={setNote}
                placeholder="Explain your decision" multiline maxLength={2000} style={styles.input} />
              {confirmCancel ? (
                <>
                  <Text style={styles.text}>Cancel this session? It will remain visible as cancelled. Other reports stay pending for separate review.</Text>
                  <ActionButton title="Confirm session cancellation" onPress={() => review('cancel_session')} />
                  <ActionButton title="Keep session" variant="secondary" onPress={() => setConfirmCancel(false)} />
                </>
              ) : (
                <>
                  <ActionButton title="Dismiss report" variant="secondary" onPress={() => review('dismiss')} />
                  <ActionButton title="Cancel session" disabled={session.status === 'cancelled'} onPress={() => {
                    if (!note.trim()) { setMessage('Enter a review reason.'); return; }
                    setMessage('');
                    setConfirmCancel(true);
                  }} />
                </>
              )}
            </>
          ) : null}
          {message ? <Text accessibilityLiveRegion="polite" style={styles.status}>{message}</Text> : null}
          <ActionButton title="Back to report list" variant="secondary" onPress={() => { setSelectedId(null); setConfirmCancel(false); setMessage(''); setNote(''); }} />
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.heading}>User report counts · All statuses</Text>
            <Text style={styles.muted}>Submitted includes both target types. Received counts direct user reports only; session reports do not count against the host.</Text>
            {REPORT_USERS.map((user) => (
              <View key={user.id} style={styles.summary}>
                <Text style={styles.heading}>@{user.username}</Text>
                <Text style={styles.text}>Submitted: {reports.filter((report) => report.reporter_id === user.id).length}
                  {' · '}Received: {reports.filter((report) => report.target_type !== 'session' && report.target_id === user.id).length}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.heading}>Reports ({visible.length})</Text>
          <View style={styles.filters}>
            {['all', 'user', 'session'].map((targetType) => (
              <Pressable key={targetType} accessibilityRole="radio" accessibilityLabel={`Report type: ${targetType}`}
                accessibilityState={{ checked: type === targetType }} onPress={() => setType(targetType)}
                style={[styles.filter, type === targetType && styles.selected]}>
                <Text style={styles.status}>{targetType === 'all' ? 'All targets' : targetType}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.filters}>
            {['all', ...REPORT_STATUSES].map((status) => (
              <Pressable key={status} accessibilityRole="radio" accessibilityState={{ checked: filter === status }}
                onPress={() => setFilter(status)} style={[styles.filter, filter === status && styles.selected]}>
                <Text style={styles.status}>{status}</Text>
              </Pressable>
            ))}
          </View>
          {visible.length === 0 ? <Text style={styles.muted}>No reports match this status.</Text> : null}
          {visible.map((report) => (
            <Pressable key={report.id} accessibilityRole="button" accessibilityLabel={`View report ${report.id} about ${reportTarget(report)}`}
              onPress={() => setSelectedId(report.id)} style={styles.card}>
              <Text style={styles.heading}>#{report.id} · {report.target_type || 'user'} · {reportTarget(report)}</Text>
              <Text style={styles.status}>{report.status}</Text>
              <Text style={styles.text}>{report.reason}</Text>
              <Text style={styles.muted}>From @{reportUsername(report.reporter_id)} · {new Date(report.created_at).toLocaleString()}</Text>
              <Text style={styles.link}>View details</Text>
            </Pressable>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 12, backgroundColor: 'white', borderRadius: 16 },
  heading: { fontSize: 17, fontWeight: '700', color: '#142d4e' },
  text: { fontSize: 16, color: '#142d4e', lineHeight: 23 },
  muted: { color: '#526277', lineHeight: 22 },
  status: { color: '#2463a0', fontWeight: '600' },
  link: { color: '#2463a0', fontSize: 16 },
  summary: { gap: 5 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { padding: 12, borderWidth: 1, borderColor: '#cfd8e3', borderRadius: 10 },
  selected: { borderColor: '#2463a0', backgroundColor: '#eaf1f9' },
  input: { borderWidth: 1, borderColor: '#cfd8e3', borderRadius: 10, padding: 12, minHeight: 80, textAlignVertical: 'top', color: '#142d4e', fontSize: 16 },
});
