import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { listBusynessReports } from '../../../api/busyness';
import { addFavorite, getFavorite, removeFavorite, setOpeningReminderEnabled } from '../../../api/favorites';
import { getSpot } from '../../../api/spots';
import ActionButton from '../../../components/ActionButton';
import BusynessCard from '../../../components/BusynessCard';
import FavoriteButton from '../../../components/FavoriteButton';
import OpeningHoursCard from '../../../components/OpeningHoursCard';
import Screen from '../../../components/Screen';
import { busynessLabel, summarizeBusyness } from '../../../lib/busyness';
import { checkInAtSpot } from '../../../lib/checkin';
import { CHECK_IN_RADIUS_METERS } from '../../../lib/proximity';
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

/** @param {import('../../../lib/checkin').CheckInResult} result */
function checkInFailureMessage(result) {
  if (!('reason' in result)) return '';
  switch (result.reason) {
    case 'permission_denied':
      return 'Location access is off for StudyScotty. Turn it on in Settings to check in.';
    case 'location_unavailable':
      return "Couldn't get your location. Move somewhere with a clearer signal and try again.";
    case 'too_far':
      return `You're about ${result.distanceMeters} m away. Get within ${CHECK_IN_RADIUS_METERS} m of the spot to check in.`;
    default:
      return 'Could not check in. Please try again.';
  }
}

export default function SpotDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const spotId = Number(Array.isArray(id) ? id[0] : id);

  const [spot, setSpot] = useState(/** @type {import('../../../api/spots').Spot | null} */ (null));
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [favorited, setFavorited] = useState(false);
  const [updatingFavorite, setUpdatingFavorite] = useState(false);
  const [favoriteMessage, setFavoriteMessage] = useState('');

  const [reminderOn, setReminderOn] = useState(false);
  const [updatingReminder, setUpdatingReminder] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('');

  const [reports, setReports] = useState(/** @type {import('../../../lib/busyness').BusynessReport[]} */ ([]));
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInMessage, setCheckInMessage] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getSpot(spotId), getFavorite(spotId), isOpeningReminderOn(spotId), listBusynessReports(spotId)])
      .then(([spotData, favorite, on, reportData]) => {
        if (!active) return;
        setSpot(spotData);
        setFavorited(!!favorite);
        setReminderOn(on);
        setReports(reportData);
      })
      .catch(() => { if (active) setLoadError('Could not load this spot.'); });
    return () => { active = false; };
  }, [spotId, loadAttempt]);

  const retryLoad = () => {
    setLoadError('');
    setLoadAttempt((value) => value + 1);
  };

  const toggleFavorite = async () => {
    setUpdatingFavorite(true);
    setFavoriteMessage('');
    try {
      if (favorited) {
        // The reminder setting lives on the favorite, so removing it also stops reminders.
        if (reminderOn) {
          await disableOpeningReminder(spot.id);
          setReminderOn(false);
        }
        await removeFavorite(spot.id);
        setFavorited(false);
        setFavoriteMessage(reminderOn ? 'Removed from favorites. Opening reminder turned off.' : 'Removed from favorites.');
      } else {
        await addFavorite(spot.id);
        setFavorited(true);
        setFavoriteMessage('Saved to your favorites.');
      }
    } catch {
      setFavoriteMessage('Could not update your favorites. Please try again.');
    } finally {
      setUpdatingFavorite(false);
    }
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
          await setOpeningReminderEnabled(spot.id, true);
          setReminderOn(true);
          setFavorited(true);
          setReminderMessage(`You'll be reminded ${REMINDER_LEAD_MINUTES} minutes before it opens. Saved to your favorites.`);
        }
      } else {
        await disableOpeningReminder(spot.id);
        await setOpeningReminderEnabled(spot.id, false);
        setReminderOn(false);
        setReminderMessage('Reminder turned off.');
      }
    } catch {
      setReminderMessage('Could not update the reminder. Please try again.');
    } finally {
      setUpdatingReminder(false);
    }
  };

  /** @param {import('../../../lib/busyness').BusynessLevel} level */
  const checkIn = async (level) => {
    setCheckingIn(true);
    setCheckInMessage('');
    try {
      const result = await checkInAtSpot(spot, level);
      if ('reason' in result) {
        setCheckInMessage(checkInFailureMessage(result));
      } else {
        setReports((current) => [result.report, ...current]);
        setCheckInMessage(`Checked in! You reported "${busynessLabel(level)}". Thanks for helping other students.`);
      }
    } finally {
      setCheckingIn(false);
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
          <View style={styles.favoriteRow}>
            <FavoriteButton favorited={favorited} onToggle={toggleFavorite} disabled={updatingFavorite} />
            {favoriteMessage ? <Text accessibilityLiveRegion="polite" style={styles.message}>{favoriteMessage}</Text> : null}
          </View>

          <BusynessCard
            summary={summarizeBusyness(reports)}
            onCheckIn={checkIn}
            checkingIn={checkingIn}
            message={checkInMessage}
          />

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
  message: { color: '#2463a0', flexShrink: 1 },
  favoriteRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  reminderText: { flex: 1, gap: 4 },
});
