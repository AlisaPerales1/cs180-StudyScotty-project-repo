/**
 * Local "spot is opening" reminders (MVP uses local scheduled notifications,
 * per AGENTS.md). One weekly notification is scheduled per opening time, a
 * short lead time before the spot opens.
 *
 * The device's scheduled notifications are the source of truth for whether a
 * reminder is on, so state survives app reloads. When the favorites API exists,
 * also sync spots.Favorite.opening_reminder_enabled.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { intervalMinutes, parseTime } from './hours';

/** @typedef {import('./hours').HoursStatus} HoursStatus */
/** @typedef {import('./hours').OpeningInterval} OpeningInterval */
/** @typedef {{ id: number, name: string, hours_status: HoursStatus, opening_hours: OpeningInterval[] }} ReminderSpot */

export const REMINDER_LEAD_MINUTES = 15;
export const REMINDER_CHANNEL_ID = 'opening-reminders';
const REMINDER_KIND = 'opening-reminder';
const MINUTES_PER_WEEK = 7 * 24 * 60;

/** Reminders rely on native scheduling; the web preview cannot schedule them. */
export const remindersSupported = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Database weekday (0=Monday ... 6=Sunday) -> expo-notifications weekly
 * trigger weekday (1=Sunday ... 7=Saturday).
 * @param {number} dbWeekday
 */
export function toExpoWeekday(dbWeekday) {
  return ((dbWeekday + 1) % 7) + 1;
}

/**
 * Weekly reminder times for a spot, as expo weekday/hour/minute.
 * Skips spots without a schedule and openings that merely continue an
 * interval that is already open (e.g. 24-hour days back to back).
 * @param {HoursStatus} hoursStatus
 * @param {OpeningInterval[]} hours
 * @param {number} [leadMinutes]
 * @returns {{ weekday: number, hour: number, minute: number }[]}
 */
export function buildReminderTimes(hoursStatus, hours, leadMinutes = REMINDER_LEAD_MINUTES) {
  if (hoursStatus !== 'scheduled') return [];

  // Minutes since Monday 00:00 for each interval's start and end.
  const ranges = hours.map((interval) => {
    const start = interval.weekday * 24 * 60 + parseTime(interval.opens_at);
    return { start, end: start + intervalMinutes(interval) };
  });
  // Sunday-night intervals end past the week, so also check one week later.
  const isOpenAt = (minute) => ranges.some(({ start, end }) => (
    (minute >= start && minute < end) || (minute + MINUTES_PER_WEEK >= start && minute + MINUTES_PER_WEEK < end)
  ));

  const seen = new Set();
  const times = [];
  for (const { start } of ranges) {
    // Already open just before this start means it is a continuation, not an opening.
    const justBefore = (start - 1 + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
    if (isOpenAt(justBefore)) continue;

    const remindAt = (((start - leadMinutes) % MINUTES_PER_WEEK) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
    if (seen.has(remindAt)) continue;
    seen.add(remindAt);
    const dbWeekday = Math.floor(remindAt / (24 * 60));
    const minuteOfDay = remindAt % (24 * 60);
    times.push({
      weekday: toExpoWeekday(dbWeekday),
      hour: Math.floor(minuteOfDay / 60),
      minute: minuteOfDay % 60,
    });
  }
  return times;
}

/** Show reminders while the app is in the foreground too. Call once at startup. */
export function configureNotifications() {
  if (!remindersSupported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** @param {number} spotId */
async function scheduledFor(spotId) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.filter(({ content }) => content.data?.kind === REMINDER_KIND && content.data?.spotId === spotId);
}

/** @param {number} spotId @returns {Promise<boolean>} */
export async function isOpeningReminderOn(spotId) {
  if (!remindersSupported) return false;
  return (await scheduledFor(spotId)).length > 0;
}

/** @returns {Promise<boolean>} */
async function ensurePermission() {
  if (Platform.OS === 'android') {
    // Android 13+ only shows the permission prompt once a channel exists.
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'Opening reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Schedule weekly reminders for a spot, replacing any existing ones.
 * @param {ReminderSpot} spot
 * @returns {Promise<{ ok: true, count: number } | { ok: false, reason: 'unsupported' | 'no_schedule' | 'permission_denied' }>}
 */
export async function enableOpeningReminder(spot) {
  if (!remindersSupported) return { ok: false, reason: 'unsupported' };
  const times = buildReminderTimes(spot.hours_status, spot.opening_hours);
  if (!times.length) return { ok: false, reason: 'no_schedule' };
  if (!(await ensurePermission())) return { ok: false, reason: 'permission_denied' };

  await disableOpeningReminder(spot.id);
  for (const time of times) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${spot.name} opens soon`,
        body: `Opens in ${REMINDER_LEAD_MINUTES} minutes. Time to grab a seat!`,
        data: { kind: REMINDER_KIND, spotId: spot.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        channelId: REMINDER_CHANNEL_ID,
        ...time,
      },
    });
  }
  return { ok: true, count: times.length };
}

/** Cancel every opening reminder for a spot. @param {number} spotId */
export async function disableOpeningReminder(spotId) {
  if (!remindersSupported) return;
  for (const request of await scheduledFor(spotId)) {
    await Notifications.cancelScheduledNotificationAsync(request.identifier);
  }
}
