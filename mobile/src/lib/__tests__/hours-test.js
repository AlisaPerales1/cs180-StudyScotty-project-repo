import {
  describeOpenStatus,
  formatClock,
  formatWeeklyHours,
  getOpenStatus,
  parseTime,
  toDbWeekday,
} from '../hours';

// Week of Monday 16 November 2026 (no daylight-saving change), local time.
const MON = 16, TUE = 17, WED = 18, THU = 19, FRI = 20, SAT = 21, SUN = 22;
/** @param {number} day @param {number} hour @param {number} [minute] */
const at = (day, hour, minute = 0) => new Date(2026, 10, day, hour, minute);

/** @param {number} weekday @param {string} opens @param {string} closes @param {boolean} [nextDay] */
const interval = (weekday, opens, closes, nextDay = false) => ({
  weekday, opens_at: opens, closes_at: closes, closes_next_day: nextDay,
});
const weekdays9to5 = [0, 1, 2, 3, 4].map((day) => interval(day, '09:00:00', '17:00:00'));

describe('parseTime', () => {
  it('parses database times with or without seconds', () => {
    expect(parseTime('08:30:00')).toBe(510);
    expect(parseTime('8:05')).toBe(485);
    expect(parseTime('00:00:00')).toBe(0);
    expect(parseTime('23:59:59')).toBe(1439);
  });

  it('rejects invalid times', () => {
    expect(() => parseTime('24:00')).toThrow('Invalid time');
    expect(() => parseTime('12:60')).toThrow('Invalid time');
    expect(() => parseTime('noon')).toThrow('Invalid time');
  });
});

describe('toDbWeekday', () => {
  it('maps dates to 0=Monday through 6=Sunday', () => {
    expect([MON, TUE, WED, THU, FRI, SAT, SUN].map((day) => toDbWeekday(at(day, 12))))
      .toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('formatClock', () => {
  it('formats minutes as 12-hour clock times', () => {
    expect(formatClock(0)).toBe('12:00 AM');
    expect(formatClock(9 * 60 + 5)).toBe('9:05 AM');
    expect(formatClock(12 * 60 + 30)).toBe('12:30 PM');
    expect(formatClock(23 * 60 + 59)).toBe('11:59 PM');
    expect(formatClock(24 * 60 + 60)).toBe('1:00 AM');
  });
});

describe('getOpenStatus', () => {
  it('reports always-accessible spots as always open', () => {
    expect(getOpenStatus('always_accessible', [], at(MON, 3))).toEqual({ state: 'always_open' });
  });

  it('reports unknown hours, including a scheduled spot with no intervals', () => {
    expect(getOpenStatus('unknown', weekdays9to5, at(MON, 10))).toEqual({ state: 'unknown' });
    expect(getOpenStatus('scheduled', [], at(MON, 10))).toEqual({ state: 'unknown' });
  });

  it('is open during an interval and gives the closing time', () => {
    expect(getOpenStatus('scheduled', weekdays9to5, at(MON, 10)))
      .toEqual({ state: 'open', closesAt: at(MON, 17) });
  });

  it('treats opening time as open and closing time as closed', () => {
    expect(getOpenStatus('scheduled', weekdays9to5, at(MON, 9)).state).toBe('open');
    expect(getOpenStatus('scheduled', weekdays9to5, at(MON, 17)))
      .toEqual({ state: 'closed', opensAt: at(TUE, 9) });
  });

  it('finds the next opening later today, or after the weekend', () => {
    expect(getOpenStatus('scheduled', weekdays9to5, at(MON, 8, 59)))
      .toEqual({ state: 'closed', opensAt: at(MON, 9) });
    expect(getOpenStatus('scheduled', weekdays9to5, at(SAT, 12)))
      .toEqual({ state: 'closed', opensAt: at(MON + 7, 9) });
  });

  it('handles intervals that close after midnight', () => {
    const fridayLate = [interval(4, '20:00:00', '02:00:00', true)];
    expect(getOpenStatus('scheduled', fridayLate, at(SAT, 1)))
      .toEqual({ state: 'open', closesAt: at(SAT, 2) });
    expect(getOpenStatus('scheduled', fridayLate, at(SAT, 2)).state).toBe('closed');
  });

  it('handles a Sunday-night interval that runs into Monday', () => {
    const sundayLate = [interval(6, '22:00:00', '01:00:00', true)];
    expect(getOpenStatus('scheduled', sundayLate, at(MON + 7, 0, 30)))
      .toEqual({ state: 'open', closesAt: at(MON + 7, 1) });
  });

  it('handles split days with a closed gap', () => {
    const split = [interval(0, '08:00', '12:00'), interval(0, '13:00', '20:00')];
    expect(getOpenStatus('scheduled', split, at(MON, 12, 30)))
      .toEqual({ state: 'closed', opensAt: at(MON, 13) });
    expect(getOpenStatus('scheduled', split, at(MON, 14)))
      .toEqual({ state: 'open', closesAt: at(MON, 20) });
  });

  it('merges back-to-back intervals into one open stretch', () => {
    const chained = [interval(0, '18:00', '00:00', true), interval(1, '00:00', '03:00')];
    expect(getOpenStatus('scheduled', chained, at(MON, 23)))
      .toEqual({ state: 'open', closesAt: at(TUE, 3) });
  });

  it('treats equal times with closes_next_day as 24 hours', () => {
    const allDayMonday = [interval(0, '00:00', '00:00', true)];
    expect(getOpenStatus('scheduled', allDayMonday, at(MON, 15)))
      .toEqual({ state: 'open', closesAt: at(TUE, 0) });
  });

  it('treats 24 hours every day as always open', () => {
    const everyDay = [0, 1, 2, 3, 4, 5, 6].map((day) => interval(day, '00:00', '00:00', true));
    expect(getOpenStatus('scheduled', everyDay, at(WED, 15))).toEqual({ state: 'always_open' });
  });

  it('looks up to a week ahead for the next opening', () => {
    const wednesdaysOnly = [interval(2, '10:00', '12:00')];
    expect(getOpenStatus('scheduled', wednesdaysOnly, at(THU, 9)))
      .toEqual({ state: 'closed', opensAt: at(WED + 7, 10) });
  });
});

describe('describeOpenStatus', () => {
  it('describes open and closed spots relative to now', () => {
    const now = at(MON, 10);
    expect(describeOpenStatus({ state: 'open', closesAt: at(MON, 17) }, now)).toBe('Open now · Closes at 5:00 PM');
    expect(describeOpenStatus({ state: 'open', closesAt: at(TUE, 2) }, now)).toBe('Open now · Closes tomorrow at 2:00 AM');
    expect(describeOpenStatus({ state: 'closed', opensAt: at(TUE, 9) }, now)).toBe('Closed · Opens tomorrow at 9:00 AM');
    expect(describeOpenStatus({ state: 'closed', opensAt: at(THU, 7, 30) }, now)).toBe('Closed · Opens Thu at 7:30 AM');
  });

  it('describes spots without a schedule', () => {
    expect(describeOpenStatus({ state: 'always_open' })).toBe('Always open');
    expect(describeOpenStatus({ state: 'unknown' })).toBe('Hours not listed');
    expect(describeOpenStatus({ state: 'closed', opensAt: null })).toBe('Closed this week');
  });
});

describe('formatWeeklyHours', () => {
  it('lists every day Monday first, sorting split intervals', () => {
    const rows = formatWeeklyHours([
      interval(0, '13:00', '20:00'),
      interval(0, '08:00', '12:00'),
      interval(4, '20:00', '02:00', true),
      interval(6, '00:00', '00:00', true),
    ]);
    expect(rows.map((row) => row.day)).toEqual(
      ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    );
    expect(rows[0].text).toBe('8:00 AM – 12:00 PM, 1:00 PM – 8:00 PM');
    expect(rows[1].text).toBe('Closed');
    expect(rows[4].text).toBe('8:00 PM – 2:00 AM');
    expect(rows[6].text).toBe('Open 24 hours');
  });
});
