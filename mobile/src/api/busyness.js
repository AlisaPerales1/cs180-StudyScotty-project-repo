/**
 * Busyness report (spot check-in) data access.
 *
 * Temporary in-memory mock until the spots busyness endpoints are agreed in
 * docs/api-contract.md. Like the real backend should, the mock re-checks
 * proximity and sets expires_at itself; clients send only the level and their
 * position. New reports persist while the app is running and reset on reload.
 */

import { expiresAtFor } from '../lib/busyness';
import { checkProximity } from '../lib/proximity';
import { MOCK_SPOTS } from './spots';

/** @typedef {import('../lib/busyness').BusynessReport} BusynessReport */
/** @typedef {import('../lib/busyness').BusynessLevel} BusynessLevel */

/** Thrown when the (mock) server rejects a check-in. */
export class CheckInRejectedError extends Error {
  /** @param {'too_far' | 'spot_not_found' | 'invalid_level'} code */
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const VALID_LEVELS = ['empty', 'some_seats', 'packed'];

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60 * 1000);

/** @param {number} id @param {number} spot @param {BusynessLevel} level @param {number} age */
const seed = (id, spot, level, age) => {
  const reportedAt = minutesAgo(age);
  return { id, spot, level, reported_at: reportedAt.toISOString(), expires_at: expiresAtFor(reportedAt).toISOString() };
};

/** @type {BusynessReport[]} */
let mockReports = [
  seed(1, 1, 'some_seats', 12),
  seed(2, 1, 'packed', 35),
  seed(3, 1, 'some_seats', 50),
  seed(4, 2, 'empty', 20),
  seed(5, 3, 'packed', 90), // already expired, so it should not count
];
let nextId = mockReports.length + 1;

const MOCK_LATENCY_MS = 400;

/** @param {number} ms */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Recent reports for a spot, newest first. @param {number} spotId @returns {Promise<BusynessReport[]>} */
export async function listBusynessReports(spotId) {
  await delay(MOCK_LATENCY_MS);
  return mockReports
    .filter((report) => report.spot === spotId)
    .sort((a, b) => b.reported_at.localeCompare(a.reported_at))
    .map((report) => ({ ...report }));
}

/**
 * Create a busyness report from a check-in.
 * @param {number} spotId
 * @param {{ level: BusynessLevel, latitude: number, longitude: number, accuracy?: number | null }} input
 * @returns {Promise<BusynessReport>}
 */
export async function createBusynessReport(spotId, { level, latitude, longitude, accuracy }) {
  await delay(MOCK_LATENCY_MS);
  if (!VALID_LEVELS.includes(level)) throw new CheckInRejectedError('invalid_level');
  const spot = MOCK_SPOTS.find((item) => item.id === spotId);
  if (!spot) throw new CheckInRejectedError('spot_not_found');
  if (!checkProximity({ latitude, longitude, accuracy }, spot).within) throw new CheckInRejectedError('too_far');

  const reportedAt = new Date();
  /** @type {BusynessReport} */
  const report = {
    id: nextId++,
    spot: spotId,
    level,
    reported_at: reportedAt.toISOString(),
    expires_at: expiresAtFor(reportedAt).toISOString(),
  };
  mockReports = [...mockReports, report];
  return { ...report };
}
