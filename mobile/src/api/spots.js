/**
 * Spot data access.
 *
 * Temporary in-memory mock until the spots endpoints are agreed in
 * docs/api-contract.md. Screens should only use the exported functions so the
 * real API can replace this file's internals.
 *
 * Fields mirror spots.Spot and spots.OpeningHours in docs/database.md. Names
 * and approximate coordinates come from the geotag seed list; the hours are
 * made up for testing and cover each hours_status plus overnight and split-day
 * schedules. Coordinates are strings because Django REST Framework serializes
 * DecimalField values as strings by default.
 */

/**
 * @typedef {{
 *   id: number,
 *   name: string,
 *   latitude: string,
 *   longitude: string,
 *   hours_status: import('../lib/hours').HoursStatus,
 *   timezone: string,
 *   opening_hours: import('../lib/hours').OpeningInterval[],
 * }} Spot
 */

/** @param {number[]} weekdays @param {string} opens @param {string} closes @param {boolean} [nextDay] */
const every = (weekdays, opens, closes, nextDay = false) => weekdays.map((weekday) => ({
  weekday, opens_at: opens, closes_at: closes, closes_next_day: nextDay,
}));

/** @type {Spot[]} */
export const MOCK_SPOTS = [
  {
    id: 1,
    name: 'Rivera Library',
    latitude: '33.974100',
    longitude: '-117.328200',
    hours_status: 'scheduled',
    timezone: 'America/Los_Angeles',
    opening_hours: [
      // Mon–Thu open past midnight, shorter weekend hours.
      ...every([0, 1, 2, 3], '07:30:00', '02:00:00', true),
      ...every([4], '07:30:00', '18:00:00'),
      ...every([5], '10:00:00', '18:00:00'),
      ...every([6], '12:00:00', '02:00:00', true),
    ],
  },
  {
    id: 2,
    name: 'Orbach Science Library',
    latitude: '33.974500',
    longitude: '-117.325600',
    hours_status: 'scheduled',
    timezone: 'America/Los_Angeles',
    opening_hours: [
      // Split weekday hours (closed over lunch), closed weekends.
      ...every([0, 1, 2, 3, 4], '08:00:00', '12:00:00'),
      ...every([0, 1, 2, 3, 4], '13:00:00', '20:00:00'),
    ],
  },
  {
    id: 3,
    name: 'Student Success Center',
    latitude: '33.975700',
    longitude: '-117.327000',
    hours_status: 'always_accessible',
    timezone: 'America/Los_Angeles',
    opening_hours: [],
  },
  {
    id: 4,
    name: 'Bell Tower Lawn',
    latitude: '33.973800',
    longitude: '-117.328100',
    hours_status: 'unknown',
    timezone: 'America/Los_Angeles',
    opening_hours: [],
  },
];

const MOCK_LATENCY_MS = 400;

/** @param {number} ms */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @param {number} spotId @returns {Promise<Spot>} */
export async function getSpot(spotId) {
  await delay(MOCK_LATENCY_MS);
  const spot = MOCK_SPOTS.find((item) => item.id === spotId);
  if (!spot) throw new Error('Spot not found');
  return { ...spot, opening_hours: spot.opening_hours.map((interval) => ({ ...interval })) };
}
