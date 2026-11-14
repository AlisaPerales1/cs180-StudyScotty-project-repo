import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getModerationAccounts, moderateAccount } from '../api/moderation';
import ActionButton from '../components/ActionButton';
import Screen from '../components/Screen';

const DURATIONS = [{ label: '1 hour', hours: 1 }, { label: '24 hours', hours: 24 }, { label: '7 days', hours: 168 }];
const LABELS = { suspend: 'Suspend', ban: 'Ban', restore: 'Restore' };

/** @param {number} hours */
function suspensionExpiry(hours) {
  return new Date(Date.now() + hours * 3600000).toISOString();
}

export default function AdminScreen() {
  const [accounts, setAccounts] = useState(/** @type {import('../api/moderation').DemoAccount[] | null} */ (null));
  const [selectedId, setSelectedId] = useState(42);
  const [query, setQuery] = useState('');
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState(24);
  const [pending, setPending] = useState(/** @type {import('../api/moderation').AccountAction | null} */ (null));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getModerationAccounts().then(setAccounts);
  }, []);

  const selected = accounts?.find((account) => account.user_id === selectedId);
  const search = query.trim().toLowerCase();
  const visible = accounts?.filter((account) =>
    `${account.username} ${account.email} ${account.user_id}`.toLowerCase().includes(search));

  /** @param {import('../api/moderation').AccountAction} action */
  function prepare(action) {
    setMessage('');
    if (action !== 'restore' && !reason.trim()) {
      setMessage('Enter a reason before suspending or banning this account.');
      return;
    }
    setPending(action);
  }

  async function confirm() {
    if (!pending || !selected || saving) return;
    setSaving(true);
    try {
      const result = await moderateAccount(selected.user_id, pending, {
        reason: reason.trim(),
        ...(pending === 'suspend' ? { ends_at: suspensionExpiry(hours) } : {}),
      });
      setAccounts((current) => current.map((account) => account.user_id === result.user_id ? { ...account, ...result } : account));
      setMessage(`Demo update: @${selected.username} is now ${result.state}.`);
      setReason('');
      setPending(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update this account.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen title="Account moderation" subtitle="Manage access to StudyScotty.">
      <View style={styles.notice}>
        <Text style={styles.heading}>Admin demo · Mock data</Text>
        <Text style={styles.muted}>Changes affect sample accounts only and reset on app reload. Admin sign-in is not connected.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Select an account</Text>
        <TextInput accessibilityLabel="Search accounts" placeholder="Search name, email, or ID" value={query}
          onChangeText={setQuery} autoCapitalize="none" style={styles.input} editable={!pending && !saving} />
        {!accounts ? <ActivityIndicator accessibilityLabel="Loading demo accounts" /> : null}
        {visible?.length === 0 ? <Text style={styles.muted}>No accounts found.</Text> : null}
        {visible?.map((account) => (
          <Pressable key={account.user_id} accessibilityRole="button"
            accessibilityState={{ selected: account.user_id === selectedId, disabled: !!pending || saving }}
            disabled={!!pending || saving} onPress={() => {
              setSelectedId(account.user_id);
              setReason('');
              setMessage('');
            }} style={[styles.account, account.user_id === selectedId && styles.selected]}>
            <Text style={styles.heading}>@{account.username}</Text>
            <Text style={styles.muted}>{account.email}</Text>
            <Text style={styles.status}>#{account.user_id} · {account.state}</Text>
          </Pressable>
        ))}
      </View>
      {selected ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Manage @{selected.username}</Text>
          <Text style={styles.status}>Current status: {selected.state}</Text>
          {selected.ends_at ? <Text style={styles.muted}>Suspended until {new Date(selected.ends_at).toLocaleString()}</Text> : null}
          <Text style={styles.label}>Reason (required for suspension or ban)</Text>
          <TextInput accessibilityLabel="Moderation reason" value={reason} onChangeText={setReason}
            placeholder="Explain the action" multiline editable={!pending && !saving} style={[styles.input, styles.reason]} />
          <Text style={styles.label}>Suspension duration</Text>
          <View style={styles.row}>
            {DURATIONS.map((duration) => (
              <Pressable key={duration.hours} accessibilityRole="radio"
                accessibilityState={{ checked: hours === duration.hours, disabled: !!pending || saving }}
                disabled={!!pending || saving} onPress={() => setHours(duration.hours)}
                style={[styles.duration, hours === duration.hours && styles.selected]}>
                <Text style={styles.status}>{duration.label}</Text>
              </Pressable>
            ))}
          </View>
          {pending ? (
            <View style={styles.notice}>
              <Text style={styles.heading}>{LABELS[pending]} @{selected.username}?</Text>
              <Text style={styles.muted}>{pending === 'suspend'
                ? `Access will be suspended for ${DURATIONS.find((duration) => duration.hours === hours).label}.`
                : pending === 'ban' ? 'Access will be banned indefinitely until restored.' : 'The current account restriction will be lifted.'}</Text>
              {reason.trim() ? <Text style={styles.muted}>Reason: {reason.trim()}</Text> : null}
              <ActionButton title={saving ? 'Applying…' : `Confirm ${LABELS[pending].toLowerCase()}`} onPress={() => confirm()} disabled={saving} />
              <ActionButton title="Cancel" variant="secondary" onPress={() => setPending(null)} disabled={saving} />
            </View>
          ) : (
            <>
              <ActionButton title="Suspend account" onPress={() => prepare('suspend')} disabled={selected.state === 'banned'} />
              <ActionButton title="Ban account" variant="secondary" onPress={() => prepare('ban')} disabled={selected.state === 'banned'} />
              <ActionButton title="Restore access" variant="secondary" onPress={() => prepare('restore')} disabled={selected.state === 'active'} />
              {selected.state === 'banned' ? <Text style={styles.muted}>Restore access before applying a suspension.</Text> : null}
            </>
          )}
        </View>
      ) : null}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.status}>{message}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 14, backgroundColor: 'white', borderRadius: 16 },
  notice: { padding: 16, gap: 10, backgroundColor: '#eaf1f9', borderRadius: 12 },
  heading: { fontSize: 17, fontWeight: '700', color: '#142d4e' },
  muted: { color: '#526277', lineHeight: 21 },
  label: { fontWeight: '600', color: '#526277' },
  status: { color: '#2463a0', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#cfd8e3', borderRadius: 10, padding: 12, fontSize: 16, color: '#142d4e' },
  reason: { minHeight: 90, textAlignVertical: 'top' },
  account: { padding: 12, gap: 4, borderWidth: 1, borderColor: '#cfd8e3', borderRadius: 10 },
  selected: { borderColor: '#2463a0', backgroundColor: '#eaf1f9' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  duration: { padding: 10, borderWidth: 1, borderColor: '#cfd8e3', borderRadius: 10 },
});
