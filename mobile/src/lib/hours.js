/**
 * Opening-hours logic, mirroring spots.Spot.hours_status and spots.OpeningHours
 * in docs/database.md:
 * - hours_status is "unknown", "always_accessible", or "scheduled".
 * - weekday is 0=Monday through 6=Sunday.
 * - opens_at/closes_at are "HH:MM[:SS]" local wall-clock times.
 * - closes_next_day=true means the interval ends after midnight; equal clock
 *   times with closes_next_day=true means open 24 hours.
 * - A weekday may have several intervals.
 *
 * Times are evaluated in the device's local timezone. All MVP spots are at UCR
 * (America/Los_Angeles), so this matches the spot timezone for campus users.
 */

/**
 * @typedef {'unknown' | 'always_accessible' | 'scheduled'} HoursStatus
 * @typedef {{ weekday: number, opens_at: string, closes_at: string, closes_next_day: boolean }} OpeningInterval
 * @typedef {{ start: Date, end: Date }} DateRange
 * @typedef {(
 *   { state: 'unknown' } |
 *   { state: 'always_open' } |
 *   { state: 'open', closesAt: Date } |
 *   { state: 'closed', opensAt: Date | null }
 * )} OpenStatus
 */

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MINUTES_PER_DAY = 24 * 60;

/** "08:30:00" or "08:30" -> minutes after midnight. @param {string} value */
export function parseTime(value) {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) throw new Error(`Invalid time: ${value}`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error(`Invalid time: ${value}`);
  return hours * 60 + minutes;
}

/** JavaScript Date -> database weekday (0=Monday ... 6=Sunday). @param {Date} date */
export function toDbWeekday(date) {
  return (date.getDay() + 6) % 7;
}

/** Length of an interval in minutes. @param {OpeningInterval} interval */
export function intervalMinutes(interval) {
  const opens = parseTime(interval.opens_at);
  const closes = parseTime(interval.closes_at);
  return interval.closes_next_day ? closes - opens + MINUTES_PER_DAY : closes - opens;
}

/**
 * Concrete open ranges overlapping [from - 1 day, from + 8 days], merged where
 * they touch or overlap (e.g. an overnight interval followed by an early one).
 * @param {OpeningInterval[]} hours
 * @param {Date} from
 * @returns {DateRange[]}
 */
export function openRangesAround(hours, from) {
  /** @type {DateRange[]} */
  const ranges = [];
  for (let offset = -1; offset <= 8; offset += 1) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
    const weekday = toDbWeekday(day);
    for (const interval of hours) {
      if (interval.weekday !== weekday) continue;
      const opens = parseTime(interval.opens_at);
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, opens);
      const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, opens + intervalMinutes(interval));
      ranges.push({ start, end });
    }
  }
  ranges.sort((a, b) => a.start.getTime() - b.start.getTime());

  /** @type {DateRange[]} */
  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      if (range.end > last.end) last.end = range.end;
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

/**
 * Whether a spot is open at `now`, and when that changes.
 * @param {HoursStatus} hoursStatus
 * @param {OpeningInterval[]} hours
 * @param {Date} [now]
 * @returns {OpenStatus}
 */
export function getOpenStatus(hoursStatus, hours, now = new Date()) {
  if (hoursStatus === 'always_accessible') return { state: 'always_open' };
  if (hoursStatus !== 'scheduled' || !hours.length) return { state: 'unknown' };

  const ranges = openRangesAround(hours, now);
  const current = ranges.find((range) => range.start <= now && now < range.end);
  // Open for over a week straight (e.g. 24 hours every day) means it never closes.
  if (current && current.end.getTime() - now.getTime() > 7 * MINUTES_PER_DAY * 60 * 1000) {
    return { state: 'always_open' };
  }
  if (current) return { state: 'open', closesAt: current.end };
  const next = ranges.find((range) => range.start > now);
  return { state: 'closed', opensAt: next ? next.start : null };
}

/** Minutes after midnight -> "8:30 AM". @param {number} minutes */
export function formatClock(minutes) {
  const normalized = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const suffix = hours24 < 12 ? 'AM' : 'PM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

/** @param {Date} date */
const clockOf = (date) => formatClock(date.getHours() * 60 + date.getMinutes());

/**
 * One-line summary, e.g. "Open now · Closes at 10:00 PM".
 * @param {OpenStatus} status
 * @param {Date} [now]
 */
export function describeOpenStatus(status, now = new Date()) {
  switch (status.state) {
    case 'always_open':
      return 'Always open';
    case 'unknown':
      return 'Hours not listed';
    case 'open':
      return `Open now · Closes ${dayPrefix(status.closesAt, now)}${clockOf(status.closesAt)}`;
    case 'closed':
      return status.opensAt
        ? `Closed · Opens ${dayPrefix(status.opensAt, now)}${clockOf(status.opensAt)}`
        : 'Closed this week';
    default:
      return '';
  }
}

/** "" for today, "tomorrow at ", or "Thu at ". @param {Date} target @param {Date} now */
function dayPrefix(target, now) {
  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOfDay(target) - startOfDay(now)) / (24 * 60 * 60 * 1000));
  if (days === 0) return 'at ';
  if (days === 1) return 'tomorrow at ';
  return `${WEEKDAY_SHORT[toDbWeekday(target)]} at `;
}

/**
 * Weekly schedule rows, Monday first, e.g. { day: 'Friday', text: '8:00 AM – 2:00 AM' }.
 * @param {OpeningInterval[]} hours
 * @returns {{ weekday: number, day: string, text: string }[]}
 */
export function formatWeeklyHours(hours) {
  return WEEKDAY_NAMES.map((day, weekday) => {
    const intervals = hours
      .filter((interval) => interval.weekday === weekday)
      .sort((a, b) => parseTime(a.opens_at) - parseTime(b.opens_at));
    if (!intervals.length) return { weekday, day, text: 'Closed' };
    const text = intervals.map((interval) => {
      if (intervalMinutes(interval) === MINUTES_PER_DAY) return 'Open 24 hours';
      return `${formatClock(parseTime(interval.opens_at))} – ${formatClock(parseTime(interval.closes_at))}`;
    }).join(', ');
    return { weekday, day, text };
  });
}
