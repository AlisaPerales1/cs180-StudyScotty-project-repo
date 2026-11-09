import {
  BUSYNESS_FRESHNESS_MINUTES,
  busynessLabel,
  expiresAtFor,
  formatTimeAgo,
  summarizeBusyness,
} from '../busyness';

const NOW = new Date(2026, 10, 16, 15, 0);
const minutesBefore = (minutes) => new Date(NOW.getTime() - minutes * 60 * 1000);

/** A report made `age` minutes before NOW, expiring after the standard window. */
const report = (id, level, age) => {
  const reportedAt = minutesBefore(age);
  return {
    id, spot: 1, level,
    reported_at: reportedAt.toISOString(),
    expires_at: expiresAtFor(reportedAt).toISOString(),
  };
};

describe('busynessLabel', () => {
  it('labels each database level', () => {
    expect(busynessLabel('empty')).toBe('Empty');
    expect(busynessLabel('some_seats')).toBe('Some seats');
    expect(busynessLabel('packed')).toBe('Packed');
  });
});

describe('expiresAtFor', () => {
  it('expires reports after the freshness window', () => {
    expect(BUSYNESS_FRESHNESS_MINUTES).toBe(60);
    expect(expiresAtFor(NOW).getTime() - NOW.getTime()).toBe(60 * 60 * 1000);
  });
});

describe('summarizeBusyness', () => {
  it('returns null when there are no reports', () => {
    expect(summarizeBusyness([], NOW)).toBeNull();
  });

  it('uses the most recent report for the level and counts every current report', () => {
    const summary = summarizeBusyness([report(1, 'packed', 40), report(2, 'some_seats', 5), report(3, 'packed', 20)], NOW);
    expect(summary).toEqual({
      level: 'some_seats',
      label: 'Some seats',
      reportedAt: minutesBefore(5),
      recentCount: 3,
      counts: { empty: 0, some_seats: 1, packed: 2 },
    });
  });

  it('ignores expired reports', () => {
    const summary = summarizeBusyness([report(1, 'packed', 90), report(2, 'empty', 30)], NOW);
    expect(summary.level).toBe('empty');
    expect(summary.recentCount).toBe(1);
  });

  it('treats a report as expired exactly at its expiry time', () => {
    expect(summarizeBusyness([report(1, 'packed', 60)], NOW)).toBeNull();
    expect(summarizeBusyness([report(1, 'packed', 59)], NOW)).not.toBeNull();
  });

  it('ignores reports dated in the future', () => {
    const future = { ...report(1, 'packed', 0), reported_at: new Date(NOW.getTime() + 60000).toISOString() };
    expect(summarizeBusyness([future], NOW)).toBeNull();
  });

  it('returns null when every report has expired', () => {
    expect(summarizeBusyness([report(1, 'empty', 120), report(2, 'packed', 75)], NOW)).toBeNull();
  });
});

describe('formatTimeAgo', () => {
  it('formats recent times in minutes and older ones in hours', () => {
    expect(formatTimeAgo(minutesBefore(0), NOW)).toBe('just now');
    expect(formatTimeAgo(minutesBefore(1), NOW)).toBe('1 min ago');
    expect(formatTimeAgo(minutesBefore(45), NOW)).toBe('45 min ago');
    expect(formatTimeAgo(minutesBefore(130), NOW)).toBe('2 hr ago');
  });
});
