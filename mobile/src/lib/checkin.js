/**
 * Spot check-in: confirm the user is at the spot with GPS, then record how
 * busy it is as a busyness report.
 *
 * For development away from campus, set EXPO_PUBLIC_SIMULATE_CHECKIN_LOCATION=true
 * in mobile/.env to use the spot's own coordinates instead of GPS. This only
 * works in development builds (__DEV__).
 */

import * as Location from 'expo-location';
import { CheckInRejectedError, createBusynessReport } from '../api/busyness';
import { checkProximity } from './proximity';

/** @typedef {import('./busyness').BusynessLevel} BusynessLevel */
/** @typedef {import('./proximity').Position} Position */
/** @typedef {{ id: number, latitude: string | number, longitude: string | number }} CheckInSpot */
/**
 * @typedef {(
 *   { ok: true, report: import('./busyness').BusynessReport, distanceMeters: number } |
 *   { ok: false, reason: 'permission_denied' | 'location_unavailable' | 'too_far' | 'failed', distanceMeters?: number }
 * )} CheckInResult
 */

export const LOCATION_TIMEOUT_MS = 15000;

/** @returns {boolean} */
export function isLocationSimulated() {
  return typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_SIMULATE_CHECKIN_LOCATION === 'true';
}

/**
 * @template T
 * @param {Promise<T>} promise @param {number} ms
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Location timed out')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

/**
 * The user's current position, asking for permission if needed.
 * @param {CheckInSpot} spot used only when the location is simulated
 * @returns {Promise<{ ok: true, position: Position } | { ok: false, reason: 'permission_denied' | 'location_unavailable' }>}
 */
export async function getCheckInPosition(spot) {
  if (isLocationSimulated()) {
    return { ok: true, position: { latitude: Number(spot.latitude), longitude: Number(spot.longitude), accuracy: 5 } };
  }
  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (!permission.granted) return { ok: false, reason: 'permission_denied' };

  try {
    const { coords } = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      LOCATION_TIMEOUT_MS,
    );
    return { ok: true, position: { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy } };
  } catch {
    return { ok: false, reason: 'location_unavailable' };
  }
}

/**
 * Check in at a spot and report how busy it is.
 * @param {CheckInSpot} spot
 * @param {BusynessLevel} level
 * @returns {Promise<CheckInResult>}
 */
export async function checkInAtSpot(spot, level) {
  const located = await getCheckInPosition(spot);
  if ('reason' in located) return { ok: false, reason: located.reason };

  const { within, distanceMeters } = checkProximity(located.position, spot);
  if (!within) return { ok: false, reason: 'too_far', distanceMeters };

  try {
    const report = await createBusynessReport(spot.id, { level, ...located.position });
    return { ok: true, report, distanceMeters };
  } catch (error) {
    if (error instanceof CheckInRejectedError && error.code === 'too_far') {
      return { ok: false, reason: 'too_far', distanceMeters };
    }
    return { ok: false, reason: 'failed' };
  }
}
