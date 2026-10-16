/**
 * Profile data access.
 *
 * Temporary in-memory mock until the accounts profile endpoint and mobile
 * authentication are agreed in docs/api-contract.md. Screens should only use
 * getProfile/updateProfile so the real API can replace this file's internals.
 * Edits persist while the app is running and reset on reload.
 */

/**
 * @typedef {{
 *   username: string,
 *   email: string,
 *   first_name: string,
 *   last_name: string,
 *   major: string,
 *   graduation_year: number | null,
 *   bio: string,
 * }} Profile
 */

/** Fields the user may change; username and email are read-only. */
export const EDITABLE_FIELDS = ['first_name', 'last_name', 'major', 'graduation_year', 'bio'];

export const BIO_MAX_LENGTH = 300;

/** @type {Profile} */
let mockProfile = {
  username: 'scotty',
  email: 'scotty@ucr.edu',
  first_name: 'Scotty',
  last_name: 'Highlander',
  major: 'Computer Science',
  graduation_year: 2028,
  bio: '',
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
