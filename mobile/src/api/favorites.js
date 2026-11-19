/**
 * Favorite spots data access.
 *
 * Temporary in-memory mock until the spots favorites endpoints and mobile
 * authentication are agreed in docs/api-contract.md. Screens should only use
 * the exported functions so the real API can replace this file's internals.
 * Favorites persist while the app is running and reset on reload.
 *
 * Fields mirror spots.Favorite in docs/database.md: one favorite per user and
 * spot (adding twice is a no-op), plus opening_reminder_enabled. The current
 * user is implied, as it will be for an authenticated endpoint.
 */

import { MOCK_SPOTS } from './spots';

/**
 * @typedef {{
 *   spot: { id: number, name: string },
 *   opening_reminder_enabled: boolean,
 *   created_at: string,
 * }} Favorite
 */

/** @type {Map<number, { opening_reminder_enabled: boolean, created_at: string }>} */
let mockFavorites = new Map([
  [2, { opening_reminder_enabled: false, created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() }],
]);

const MOCK_LATENCY_MS = 300;

/** @param {number} ms */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @param {number} spotId @returns {Favorite} */
function toFavorite(spotId) {
  const spot = MOCK_SPOTS.find((item) => item.id === spotId);
  const saved = mockFavorites.get(spotId);
  return { spot: { id: spot.id, name: spot.name }, ...saved };
}

/** @param {number} spotId */
function requireSpot(spotId) {
  if (!MOCK_SPOTS.some((item) => item.id === spotId)) throw new Error('Spot not found');
}

/** Newest first. @returns {Promise<Favorite[]>} */
export async function listFavorites() {
  await delay(MOCK_LATENCY_MS);
  return [...mockFavorites.keys()]
    .map(toFavorite)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** @param {number} spotId @returns {Promise<Favorite | null>} */
export async function getFavorite(spotId) {
  await delay(MOCK_LATENCY_MS);
  return mockFavorites.has(spotId) ? toFavorite(spotId) : null;
}

/** Idempotent, like the unique user/spot constraint. @param {number} spotId @returns {Promise<Favorite>} */
export async function addFavorite(spotId) {
  await delay(MOCK_LATENCY_MS);
  requireSpot(spotId);
  if (!mockFavorites.has(spotId)) {
    mockFavorites = new Map(mockFavorites).set(spotId, {
      opening_reminder_enabled: false,
      created_at: new Date().toISOString(),
    });
  }
  return toFavorite(spotId);
}

/** No-op if the spot is not a favorite. @param {number} spotId */
export async function removeFavorite(spotId) {
  await delay(MOCK_LATENCY_MS);
  const next = new Map(mockFavorites);
  next.delete(spotId);
  mockFavorites = next;
}

/**
 * Turn the opening reminder flag on or off. Turning it on favorites the spot
 * if needed, because the flag lives on the favorite.
 * @param {number} spotId @param {boolean} enabled
 * @returns {Promise<Favorite | null>}
 */
export async function setOpeningReminderEnabled(spotId, enabled) {
  await delay(MOCK_LATENCY_MS);
  requireSpot(spotId);
  const saved = mockFavorites.get(spotId);
  if (!saved && !enabled) return null;
  mockFavorites = new Map(mockFavorites).set(spotId, {
    opening_reminder_enabled: enabled,
    created_at: saved?.created_at ?? new Date().toISOString(),
  });
  return toFavorite(spotId);
}
