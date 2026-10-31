/**
 * Spot data access.
 *
 * Temporary in-memory mock until the spots endpoints are agreed in
 * docs/api-contract.md. Screens should only use the exported functions so the
 * real API can replace this file's internals.
 *
 * Fields mirror spots.Spot and spots.OpeningHours in docs/database.md. Names
 * come from the geotag seed list; the hours are made up for testing and cover
 * each hours_status plus overnight and split-day schedules.
 */

/**
 * @typedef {{
 *   id: number,
 *   name: string,
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
    hours_status: 'always_accessible',
    timezone: 'America/Los_Angeles',
    opening_hours: [],
  },
  {
    id: 4,
    name: 'Bell Tower Lawn',
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
