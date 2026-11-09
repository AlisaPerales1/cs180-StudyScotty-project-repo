/**
 * Proximity check for spot check-ins.
 *
 * AGENTS.md puts the authoritative check in backend/common/proximity.py, shared
 * by busyness reports and session check-ins. This is the app-side version so
 * users get immediate feedback; the backend must still verify. The radius and
 * GPS-accuracy allowance are provisional until the team agrees on them.
 */

/** @typedef {{ latitude: number | string, longitude: number | string }} Coordinates */
/** @typedef {{ latitude: number, longitude: number, accuracy?: number | null }} Position */

export const CHECK_IN_RADIUS_METERS = 100;
/** Most of a reading's reported GPS error that we forgive, so indoor fixes still count. */
export const MAX_ACCURACY_ALLOWANCE_METERS = 50;

const EARTH_RADIUS_METERS = 6371000;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/**
 * Great-circle (haversine) distance in meters. Accepts numbers or the decimal
 * strings Django REST Framework returns for DecimalField.
 * @param {Coordinates} from
 * @param {Coordinates} to
 */
export function distanceMeters(from, to) {
  const lat1 = toRadians(Number(from.latitude));
  const lat2 = toRadians(Number(to.latitude));
  const dLat = lat2 - lat1;
  const dLng = toRadians(Number(to.longitude) - Number(from.longitude));
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Whether a GPS position is close enough to a spot to check in.
 * @param {Position} position
 * @param {Coordinates} spot
 * @param {number} [radiusMeters]
 * @returns {{ within: boolean, distanceMeters: number }}
 */
export function checkProximity(position, spot, radiusMeters = CHECK_IN_RADIUS_METERS) {
  const distance = distanceMeters(position, spot);
  const allowance = Math.min(Math.max(position.accuracy ?? 0, 0), MAX_ACCURACY_ALLOWANCE_METERS);
  return { within: distance - allowance <= radiusMeters, distanceMeters: Math.round(distance) };
}
