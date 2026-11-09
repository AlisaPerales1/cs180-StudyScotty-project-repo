/**
 * Busyness levels and "how busy is it right now" summaries, mirroring
 * spots.BusynessReport in docs/database.md (level is empty, some_seats, or
 * packed; expires_at must be later than reported_at).
 */

/** @typedef {'empty' | 'some_seats' | 'packed'} BusynessLevel */
/**
 * @typedef {{
 *   id: number,
 *   spot: number,
 *   level: BusynessLevel,
 *   reported_at: string,
 *   expires_at: string,
 * }} BusynessReport
 */

/** @type {{ value: BusynessLevel, label: string }[]} */
export const BUSYNESS_LEVELS = [
  { value: 'empty', label: 'Empty' },
  { value: 'some_seats', label: 'Some seats' },
  { value: 'packed', label: 'Packed' },
];

/**
 * How long a report counts as current. The proposal says both one and two
 * hours; this uses one hour until the team decides (see AGENTS.md).
 */
export const BUSYNESS_FRESHNESS_MINUTES = 60;

/** @param {BusynessLevel} level */
export function busynessLabel(level) {
  return BUSYNESS_LEVELS.find((item) => item.value === level)?.label ?? 'Unknown';
}

/** @param {Date} reportedAt */
export function expiresAtFor(reportedAt) {
  return new Date(reportedAt.getTime() + BUSYNESS_FRESHNESS_MINUTES * 60 * 1000);
}

/**
 * Current busyness from unexpired reports: the latest report sets the level,
 * and counts show how many recent check-ins agree.
 * @param {BusynessReport[]} reports
 * @param {Date} [now]
 * @returns {null | {
 *   level: BusynessLevel,
 *   label: string,
 *   reportedAt: Date,
 *   recentCount: number,
 *   counts: Record<BusynessLevel, number>,
 * }}
 */
export function summarizeBusyness(reports, now = new Date()) {
  const current = reports
    .filter((report) => new Date(report.reported_at) <= now && now < new Date(report.expires_at))
    .sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
  if (!current.length) return null;

  /** @type {Record<BusynessLevel, number>} */
  const counts = { empty: 0, some_seats: 0, packed: 0 };
  for (const report of current) counts[report.level] += 1;
  const latest = current[0];
  return {
    level: latest.level,
    label: busynessLabel(latest.level),
    reportedAt: new Date(latest.reported_at),
    recentCount: current.length,
    counts,
  };
}

/** "just now", "1 min ago", "25 min ago", "1 hr ago". @param {Date} then @param {Date} [now] */
export function formatTimeAgo(then, now = new Date()) {
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} hr ago`;
}
