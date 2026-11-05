import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { getSpot } from '../../../api/spots';
import ActionButton from '../../../components/ActionButton';
import OpeningHoursCard from '../../../components/OpeningHoursCard';
import Screen from '../../../components/Screen';
import {
  REMINDER_LEAD_MINUTES,
  disableOpeningReminder,
  enableOpeningReminder,
  isOpeningReminderOn,
  remindersSupported,
} from '../../../lib/reminders';

const FAILURE_MESSAGES = {
  unsupported: 'Reminders are only available in the iOS and Android app.',
  no_schedule: 'Reminders need a weekly schedule, so they are unavailable for this spot.',
  permission_denied: 'Notifications are turned off for StudyScotty. Enable them in Settings to get reminders.',
};

export default function SpotDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const spotId = Number(Array.isArray(id) ? id[0] : id);

  const [spot, setSpot] = useState(/** @type {import('../../../api/spots').Spot | null} */ (null));
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [reminderOn, setReminderOn] = useState(false);
  const [updatingReminder, setUpdatingReminder] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getSpot(spotId), isOpeningReminderOn(spotId)])
      .then(([spotData, on]) => {
        if (!active) return;
        setSpot(spotData);
        setReminderOn(on);
      })
      .catch(() => { if (active) setLoadError('Could not load this spot.'); });
    return () => { active = false; };
  }, [spotId, loadAttempt]);

  const retryLoad = () => {
    setLoadError('');
    setLoadAttempt((value) => value + 1);
  };

  /** @param {boolean} next */
  const toggleReminder = async (next) => {
    setUpdatingReminder(true);
    setReminderMessage('');
    try {
      if (next) {
        const result = await enableOpeningReminder(spot);
        if ('reason' in result) {
          setReminderMessage(FAILURE_MESSAGES[result.reason]);
        } else {
          setReminderOn(true);
          setReminderMessage(`You'll be reminded ${REMINDER_LEAD_MINUTES} minutes before it opens.`);
        }
      } else {
        await disableOpeningReminder(spot.id);
        setReminderOn(false);
        setReminderMessage('Reminder turned off.');
      }
    } catch {
      setReminderMessage('Could not update the reminder. Please try again.');
    } finally {
      setUpdatingReminder(false);
    }
  };

  const canRemind = remindersSupported && spot?.hours_status === 'scheduled';

  return (
    <Screen title={spot ? spot.name : 'Study spot'}>
      <Pressable accessibilityRole="link" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
        <Text style={styles.link}>‹ Back</Text>
      </Pressable>

      {loadError ? (
        <View style={styles.card}>
          <Text>{loadError}</Text>
          <ActionButton title="Try again" onPress={retryLoad} />
        </View>
      ) : !spot ? (
        <ActivityIndicator accessibilityLabel="Loading spot" />
      ) : (
        <>
          <OpeningHoursCard hoursStatus={spot.hours_status} hours={spot.opening_hours} />

          <View style={styles.card}>
            <View style={styles.reminderRow}>
              <View style={styles.reminderText}>
                <Text style={styles.heading}>Opening reminder</Text>
                <Text style={styles.muted}>
                  {canRemind
                    ? `Get a notification ${REMINDER_LEAD_MINUTES} minutes before ${spot.name} opens.`
                    : FAILURE_MESSAGES[remindersSupported ? 'no_schedule' : 'unsupported']}
                </Text>
              </View>
              <Switch
                accessibilityLabel="Remind me when this spot opens"
                value={reminderOn}
                onValueChange={toggleReminder}
                disabled={!canRemind || updatingReminder}
              />
            </View>
            {reminderMessage ? <Text accessibilityLiveRegion="polite" style={styles.message}>{reminderMessage}</Text> : null}
          </View>

          <Link href={`/spots/${spot.id}/reviews`} style={styles.link}>Ratings & reviews ›</Link>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 12, backgroundColor: 'white', borderRadius: 16 },
  link: { color: '#2463a0', fontSize: 16, fontWeight: '600' },
  heading: { fontSize: 18, fontWeight: '700', color: '#142d4e' },
  muted: { color: '#7a8797' },
  message: { color: '#2463a0' },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  reminderText: { flex: 1, gap: 4 },
});
