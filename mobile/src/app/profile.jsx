import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BIO_MAX_LENGTH, getProfile, updateProfile } from '../api/profile';
import ConnectionStatus from '../components/ConnectionStatus';
import Screen from '../components/Screen';

const NAME_MAX_LENGTH = 150;

/** @param {import('../api/profile').Profile} profile */
function toDraft(profile) {
  return {
    first_name: profile.first_name,
    last_name: profile.last_name,
    major: profile.major,
    graduation_year: profile.graduation_year == null ? '' : String(profile.graduation_year),
    bio: profile.bio,
  };
}

/** @param {ReturnType<typeof toDraft>} draft */
function validate(draft) {
  /** @type {Record<string, string>} */
  const errors = {};
  if (!draft.first_name.trim()) errors.first_name = 'First name is required.';
  else if (draft.first_name.trim().length > NAME_MAX_LENGTH) errors.first_name = `Use ${NAME_MAX_LENGTH} characters or fewer.`;
  if (draft.last_name.trim().length > NAME_MAX_LENGTH) errors.last_name = `Use ${NAME_MAX_LENGTH} characters or fewer.`;
  const year = draft.graduation_year.trim();
  if (year) {
    const thisYear = new Date().getFullYear();
    if (!/^\d{4}$/.test(year) || Number(year) < thisYear - 1 || Number(year) > thisYear + 8) {
      errors.graduation_year = `Enter a year between ${thisYear - 1} and ${thisYear + 8}.`;
    }
  }
  if (draft.bio.length > BIO_MAX_LENGTH) errors.bio = `Use ${BIO_MAX_LENGTH} characters or fewer.`;
  return errors;
}

/** @param {ReturnType<typeof toDraft>} draft */
function toChanges(draft) {
  const year = draft.graduation_year.trim();
  return {
    first_name: draft.first_name.trim(),
    last_name: draft.last_name.trim(),
    major: draft.major.trim(),
    graduation_year: year ? Number(year) : null,
    bio: draft.bio.trim(),
  };
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState(/** @type {import('../api/profile').Profile | null} */ (null));
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(/** @type {ReturnType<typeof toDraft> | null} */ (null));
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getProfile()
      .then((data) => { if (active) setProfile(data); })
      .catch(() => { if (active) setLoadError('Could not load your profile.'); });
    return () => { active = false; };
  }, [loadAttempt]);

  const retryLoad = () => {
    setLoadError('');
    setLoadAttempt((value) => value + 1);
  };

  const startEditing = () => {
    setDraft(toDraft(profile));
    setErrors({});
    setMessage('');
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setDraft(null);
    setErrors({});
  };

  /** @param {keyof ReturnType<typeof toDraft>} field @param {string} value */
  const setField = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const save = async () => {
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setMessage('');
    try {
      setProfile(await updateProfile(toChanges(draft)));
      setEditing(false);
      setDraft(null);
      setMessage('Profile saved.');
    } catch {
      setMessage('Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Your study space" subtitle="Your profile, courses, and favorite places will live here.">
      {loadError ? (
        <View style={styles.card}>
          <Text>{loadError}</Text>
          <ActionButton title="Try again" onPress={retryLoad} />
        </View>
      ) : !profile ? (
        <ActivityIndicator accessibilityLabel="Loading profile" />
      ) : editing ? (
        <View style={styles.card}>
          <Field label="First name" value={draft.first_name} error={errors.first_name}
            onChangeText={(value) => setField('first_name', value)} autoComplete="given-name" />
          <Field label="Last name" value={draft.last_name} error={errors.last_name}
            onChangeText={(value) => setField('last_name', value)} autoComplete="family-name" />
          <Field label="Major" value={draft.major} error={errors.major}
            onChangeText={(value) => setField('major', value)} />
          <Field label="Graduation year" value={draft.graduation_year} error={errors.graduation_year}
            onChangeText={(value) => setField('graduation_year', value)} keyboardType="number-pad" maxLength={4} />
          <Field label={`Bio (${draft.bio.length}/${BIO_MAX_LENGTH})`} value={draft.bio} error={errors.bio}
            onChangeText={(value) => setField('bio', value)} multiline />
          <View style={styles.actions}>
            <ActionButton title="Cancel" variant="secondary" onPress={cancelEditing} disabled={saving} />
            <ActionButton title={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} />
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.name}>{[profile.first_name, profile.last_name].filter(Boolean).join(' ')}</Text>
          <Text style={styles.muted}>@{profile.username} · {profile.email}</Text>
          <Detail label="Major" value={profile.major} />
          <Detail label="Graduation year" value={profile.graduation_year == null ? '' : String(profile.graduation_year)} />
          <Detail label="Bio" value={profile.bio} />
          <ActionButton title="Edit profile" onPress={startEditing} />
        </View>
      )}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
      <Text>Sign-in and UCR email verification are coming next.</Text>
      <ConnectionStatus />
    </Screen>
  );
}

/** @param {{ label: string, value: string }} props */
function Detail({ label, value }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.label}>{label}</Text>
      <Text style={value ? styles.value : styles.muted}>{value || 'Not set'}</Text>
    </View>
  );
}

/** @param {{ label: string, error?: string } & import('react-native').TextInputProps} props */
function Field({ label, error, multiline, ...inputProps }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        accessibilityLabel={label}
        style={[styles.input, multiline && styles.multiline, error && styles.inputError]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/** @param {{ title: string, onPress: () => void, disabled?: boolean, variant?: 'primary' | 'secondary' }} props */
function ActionButton({ title, onPress, disabled, variant = 'primary' }) {
  const secondary = variant === 'secondary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 14, backgroundColor: 'white', borderRadius: 16 },
  name: { fontSize: 22, fontWeight: '700', color: '#142d4e' },
  muted: { color: '#7a8797' },
  detail: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#526277' },
  value: { fontSize: 16, color: '#142d4e' },
  input: {
    borderWidth: 1, borderColor: '#cfd8e3', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#142d4e',
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  inputError: { borderColor: '#c0392b' },
  error: { color: '#c0392b', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  button: { backgroundColor: '#2463a0', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center' },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#2463a0' },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 16 },
  buttonTextSecondary: { color: '#2463a0' },
  message: { color: '#2463a0' },
});
