/**
 * Profile data access.
 *
 * Uses the authenticated GET/PATCH accounts/me/ contract in docs/api-contract.md.
 *
 * Fields mirror the database (docs/database.md): username, email, first_name,
 * and last_name come from accounts.User; study_preferences comes from
 * accounts.UserProfile. study_preferences is also the profile bio/description;
 * do not send separate bio or description keys to the backend.
 */

import { apiGet, apiPatch } from './client';

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
 * Username is a display name; sign-in uses email.
 */
export const EDITABLE_FIELDS = ['username', 'first_name', 'last_name', 'study_preferences'];

/** Matches Django's AbstractUser first_name/last_name max_length. */
export const NAME_MAX_LENGTH = 150;

/** @returns {Promise<Profile>} */
export async function getProfile() {
  return apiGet('accounts/me/');
}

/**
 * Apply a partial update to the editable fields.
 * @param {Partial<Profile>} changes
 * @returns {Promise<Profile>}
 */
export async function updateProfile(changes) {
  const allowed = Object.fromEntries(
    Object.entries(changes).filter(([key]) => EDITABLE_FIELDS.includes(key)),
  );
  return apiPatch('accounts/me/', allowed);
}
