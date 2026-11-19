import * as Notifications from 'expo-notifications';
import {
  REMINDER_CHANNEL_ID,
  buildReminderTimes,
  disableOpeningReminder,
  enableOpeningReminder,
  isOpeningReminderOn,
  toExpoWeekday,
} from '../reminders';

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { WEEKLY: 'weekly' },
  AndroidImportance: { DEFAULT: 3 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
}));

/** @param {number} weekday @param {string} opens @param {string} closes @param {boolean} [nextDay] */
const interval = (weekday, opens, closes, nextDay = false) => ({
  weekday, opens_at: opens, closes_at: closes, closes_next_day: nextDay,
});

/** @param {string} identifier @param {number} spotId @param {string} [kind] */
const scheduled = (identifier, spotId, kind = 'opening-reminder') => ({
  identifier, content: { data: { kind, spotId } }, trigger: null,
});

describe('toExpoWeekday', () => {
  it('converts 0=Monday..6=Sunday to expo 1=Sunday..7=Saturday', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(toExpoWeekday)).toEqual([2, 3, 4, 5, 6, 7, 1]);
  });
});

describe('buildReminderTimes', () => {
  it('returns nothing for spots without a weekly schedule', () => {
    expect(buildReminderTimes('unknown', [])).toEqual([]);
    expect(buildReminderTimes('always_accessible', [])).toEqual([]);
    expect(buildReminderTimes('unknown', [interval(0, '09:00', '17:00')])).toEqual([]);
  });

  it('reminds 15 minutes before each opening by default', () => {
    expect(buildReminderTimes('scheduled', [interval(0, '09:00', '17:00'), interval(4, '07:30', '12:00')]))
      .toEqual([
        { weekday: 2, hour: 8, minute: 45 },
        { weekday: 6, hour: 7, minute: 15 },
      ]);
  });

  it('supports a custom lead time', () => {
    expect(buildReminderTimes('scheduled', [interval(2, '10:00', '11:00')], 0))
      .toEqual([{ weekday: 4, hour: 10, minute: 0 }]);
  });

  it('moves a reminder to the previous day when the lead time crosses midnight', () => {
    expect(buildReminderTimes('scheduled', [interval(0, '00:10', '06:00')]))
      .toEqual([{ weekday: 1, hour: 23, minute: 55 }]);
  });

  it('skips openings that continue an interval that is already open', () => {
    const chained = [interval(0, '20:00', '00:00', true), interval(1, '00:00', '02:00')];
    expect(buildReminderTimes('scheduled', chained)).toEqual([{ weekday: 2, hour: 19, minute: 45 }]);
  });

  it('skips a Monday opening that continues a Sunday-night interval', () => {
    const wrap = [interval(6, '22:00', '02:00', true), interval(0, '02:00', '05:00')];
    expect(buildReminderTimes('scheduled', wrap)).toEqual([{ weekday: 1, hour: 21, minute: 45 }]);
  });

  it('returns nothing when the spot is open 24 hours every day', () => {
    const everyDay = [0, 1, 2, 3, 4, 5, 6].map((day) => interval(day, '00:00', '00:00', true));
    expect(buildReminderTimes('scheduled', everyDay)).toEqual([]);
  });

  it('does not repeat duplicate intervals', () => {
    const duplicate = [interval(3, '09:00', '10:00'), interval(3, '09:00', '10:00')];
    expect(buildReminderTimes('scheduled', duplicate)).toHaveLength(1);
  });
});

describe('scheduling reminders', () => {
  const spot = {
    id: 7,
    name: 'Rivera Library',
    hours_status: /** @type {const} */ ('scheduled'),
    opening_hours: [interval(0, '09:00', '17:00'), interval(2, '09:00', '17:00')],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Notifications.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  });

  it('schedules one weekly notification per opening', async () => {
    await expect(enableOpeningReminder(spot)).resolves.toEqual({ ok: true, count: 2 });

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: expect.objectContaining({
        title: 'Rivera Library opens soon',
        data: { kind: 'opening-reminder', spotId: 7 },
      }),
      trigger: { type: 'weekly', channelId: REMINDER_CHANNEL_ID, weekday: 2, hour: 8, minute: 45 },
    });
  });

  it('replaces existing reminders for the same spot only', async () => {
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      scheduled('old-7', 7),
      scheduled('other-spot', 8),
      scheduled('session-reminder', 7, 'session-reminder'),
    ]);

    await enableOpeningReminder(spot);

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-7');
  });

  it('asks for permission when it has not been granted yet', async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    Notifications.requestPermissionsAsync.mockResolvedValue({ granted: true });

    await expect(enableOpeningReminder(spot)).resolves.toEqual({ ok: true, count: 2 });
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  it('schedules nothing when permission is denied', async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    Notifications.requestPermissionsAsync.mockResolvedValue({ granted: false });

    await expect(enableOpeningReminder(spot)).resolves.toEqual({ ok: false, reason: 'permission_denied' });
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('does not prompt again after the user blocked notifications', async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });

    await expect(enableOpeningReminder(spot)).resolves.toEqual({ ok: false, reason: 'permission_denied' });
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('refuses spots without a schedule before asking for permission', async () => {
    const result = await enableOpeningReminder({ ...spot, hours_status: 'always_accessible', opening_hours: [] });

    expect(result).toEqual({ ok: false, reason: 'no_schedule' });
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('cancels every reminder for a spot', async () => {
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      scheduled('a', 7), scheduled('b', 7), scheduled('c', 8),
    ]);

    await disableOpeningReminder(7);

    expect(Notifications.cancelScheduledNotificationAsync.mock.calls).toEqual([['a'], ['b']]);
  });

  it('reports whether a spot has reminders scheduled', async () => {
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([scheduled('a', 7)]);

    await expect(isOpeningReminderOn(7)).resolves.toBe(true);
    await expect(isOpeningReminderOn(8)).resolves.toBe(false);
  });
});
