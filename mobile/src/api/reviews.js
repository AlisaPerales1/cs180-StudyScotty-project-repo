/**
 * Spot review data access.
 *
 * Temporary in-memory mock until the spots review endpoints and mobile
 * authentication are agreed in docs/api-contract.md. Screens should only use
 * the exported functions so the real API can replace this file's internals.
 * New reviews persist while the app is running and reset on reload.
 *
 * Review fields mirror spots.Review in docs/database.md: rating is 1–5 and
 * required, comment is optional text. One-review-per-user-per-spot is still
 * undecided, so the mock allows several reviews from the same user.
 */

import { getProfile } from './profile';

/**
 * @typedef {{ username: string, first_name: string, last_name: string }} ReviewAuthor
 * @typedef {{
 *   id: number,
 *   spot: number,
 *   author: ReviewAuthor,
 *   rating: number,
 *   comment: string,
 *   created_at: string,
 *   updated_at: string,
 * }} Review
 * @typedef {{ id: number, name: string }} SpotSummary
 */

export const RATING_MIN = 1;
export const RATING_MAX = 5;

/** Placeholder spots (names from the geotag seed list) until the spots API is connected. */
export const MOCK_SPOTS = [
  { id: 1, name: 'Rivera Library' },
  { id: 2, name: 'Orbach Science Library' },
  { id: 3, name: 'Student Success Center' },
];

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

/** @param {number} id @param {number} spot @param {ReviewAuthor} author @param {number} rating @param {string} comment @param {number} age */
const seed = (id, spot, author, rating, comment, age) => ({
  id, spot, author, rating, comment, created_at: daysAgo(age), updated_at: daysAgo(age),
});

const ALEX = { username: 'alexr', first_name: 'Alex', last_name: 'Rivera' };
const JORDAN = { username: 'jlee', first_name: 'Jordan', last_name: 'Lee' };
const SAM = { username: 'samp', first_name: 'Sam', last_name: '' };

/** @type {Review[]} */
let mockReviews = [
  seed(1, 1, ALEX, 5, 'Group rooms on the 2nd floor are great if you book ahead.', 2),
  seed(2, 1, JORDAN, 4, 'Quiet and lots of outlets, but it fills up during finals.', 6),
  seed(3, 1, SAM, 3, '', 12),
  seed(4, 2, JORDAN, 5, 'Silent floor is perfect for deep focus.', 3),
];
let nextId = mockReviews.length + 1;

const MOCK_LATENCY_MS = 400;

/** @param {number} ms */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @param {number} spotId @returns {Promise<SpotSummary>} */
export async function getSpotSummary(spotId) {
  await delay(MOCK_LATENCY_MS);
  const spot = MOCK_SPOTS.find((item) => item.id === spotId);
  if (!spot) throw new Error('Spot not found');
  return { ...spot };
}

/** Newest first. @param {number} spotId @returns {Promise<Review[]>} */
export async function listReviews(spotId) {
  await delay(MOCK_LATENCY_MS);
  return mockReviews
    .filter((review) => review.spot === spotId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((review) => ({ ...review }));
}

/**
 * @param {number} spotId
 * @param {{ rating: number, comment: string }} input
 * @returns {Promise<Review>}
 */
export async function createReview(spotId, { rating, comment }) {
  if (!Number.isInteger(rating) || rating < RATING_MIN || rating > RATING_MAX) {
    throw new Error(`Rating must be between ${RATING_MIN} and ${RATING_MAX}.`);
  }
  const { username, first_name, last_name } = await getProfile();
  const now = new Date().toISOString();
  /** @type {Review} */
  const review = {
    id: nextId++,
    spot: spotId,
    author: { username, first_name, last_name },
    rating,
    comment: comment.trim(),
    created_at: now,
    updated_at: now,
  };
  mockReviews = [...mockReviews, review];
  return { ...review };
}
