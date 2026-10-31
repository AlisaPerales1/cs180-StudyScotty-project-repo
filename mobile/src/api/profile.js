/**
 * Profile data access.
 *
 * Temporary in-memory mock while mobile authentication is being implemented.
 * The backend GET/PATCH accounts/me/ contract is in docs/api-contract.md. Screens should only use
 * getProfile/updateProfile so the real API can replace this file's internals.
 * Edits persist while the app is running and reset on reload.
 *
 * Fields mirror the database (docs/database.md): username, email, first_name,
 * and last_name come from accounts.User; study_preferences comes from
 * accounts.UserProfile.
 */

/**
 * @typedef {{
 *   username: string,
 *   email: string,
 *   first_name: string,
 *   last_name: string,
 *   study_preferences: string,
 * }} Profile
 */

/**
 * Fields the user may change. Email stays read-only pending UCR verification.
 * Username changes also change the username used to sign in.
 */
export const EDITABLE_FIELDS = ['username', 'first_name', 'last_name', 'study_preferences'];

/** Matches Django's AbstractUser first_name/last_name max_length. */
export const NAME_MAX_LENGTH = 150;

/** @type {Profile} */
let mockProfile = {
  username: 'scotty',
  email: 'scotty@ucr.edu',
  first_name: 'Scotty',
  last_name: 'Highlander',
  study_preferences: '',
};

const MOCK_LATENCY_MS = 400;

/** @param {number} ms */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @returns {Promise<Profile>} */
export async function getProfile() {
  await delay(MOCK_LATENCY_MS);
  return { ...mockProfile };
}

/**
 * Apply a partial update to the editable fields.
 * @param {Partial<Profile>} changes
 * @returns {Promise<Profile>}
 */
export async function updateProfile(changes) {
  await delay(MOCK_LATENCY_MS);
  const allowed = Object.fromEntries(
    Object.entries(changes).filter(([key]) => EDITABLE_FIELDS.includes(key)),
  );
  mockProfile = { ...mockProfile, ...allowed };
  return { ...mockProfile };
}
