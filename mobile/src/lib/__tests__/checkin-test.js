import * as Location from 'expo-location';
import { CheckInRejectedError, createBusynessReport } from '../../api/busyness';
import { checkInAtSpot, getCheckInPosition } from '../checkin';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock('../../api/busyness', () => {
  const actual = jest.requireActual('../../api/busyness');
  return { ...actual, createBusynessReport: jest.fn() };
});

const SPOT = { id: 1, latitude: '33.974100', longitude: '-117.328200' };
const AT_SPOT = { latitude: 33.9741, longitude: -117.3282, accuracy: 10 };
const FAR_AWAY = { latitude: 33.9800, longitude: -117.3282, accuracy: 10 }; // about 656 m north
const REPORT = { id: 9, spot: 1, level: 'empty', reported_at: '2026-11-16T23:00:00.000Z', expires_at: '2026-11-17T00:00:00.000Z' };

const grantPermission = () => {
  Location.getForegroundPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
};
const standAt = (coords) => {
  Location.getCurrentPositionAsync.mockResolvedValue({ coords, timestamp: 0 });
};

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.EXPO_PUBLIC_SIMULATE_CHECKIN_LOCATION;
});

describe('getCheckInPosition', () => {
  it('asks for permission when it has not been decided yet', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    standAt(AT_SPOT);

    await expect(getCheckInPosition(SPOT)).resolves.toEqual({ ok: true, position: AT_SPOT });
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: Location.Accuracy.High });
  });

  it('does not prompt again after the user blocked location access', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });

    await expect(getCheckInPosition(SPOT)).resolves.toEqual({ ok: false, reason: 'permission_denied' });
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('reports the location as unavailable when GPS fails', async () => {
    grantPermission();
    Location.getCurrentPositionAsync.mockRejectedValue(new Error('No signal'));

    await expect(getCheckInPosition(SPOT)).resolves.toEqual({ ok: false, reason: 'location_unavailable' });
  });

  it('gives up when GPS takes too long', async () => {
    jest.useFakeTimers();
    try {
      grantPermission();
      Location.getCurrentPositionAsync.mockReturnValue(new Promise(() => {}));

      const pending = getCheckInPosition(SPOT);
      await jest.advanceTimersByTimeAsync(15000);
      await expect(pending).resolves.toEqual({ ok: false, reason: 'location_unavailable' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('uses the spot itself when location simulation is on in development', async () => {
    process.env.EXPO_PUBLIC_SIMULATE_CHECKIN_LOCATION = 'true';

    await expect(getCheckInPosition(SPOT)).resolves.toEqual({
      ok: true, position: { latitude: 33.9741, longitude: -117.3282, accuracy: 5 },
    });
    expect(Location.getForegroundPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('checkInAtSpot', () => {
  it('creates a busyness report when the user is at the spot', async () => {
    grantPermission();
    standAt(AT_SPOT);
    createBusynessReport.mockResolvedValue(REPORT);

    await expect(checkInAtSpot(SPOT, 'empty')).resolves.toEqual({ ok: true, report: REPORT, distanceMeters: 0 });
    expect(createBusynessReport).toHaveBeenCalledWith(1, { level: 'empty', ...AT_SPOT });
  });

  it('refuses to check in from too far away, without contacting the server', async () => {
    grantPermission();
    standAt(FAR_AWAY);

    const result = await checkInAtSpot(SPOT, 'packed');

    expect(result).toEqual({ ok: false, reason: 'too_far', distanceMeters: 656 });
    expect(createBusynessReport).not.toHaveBeenCalled();
  });

  it('does not check in without location permission', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });

    await expect(checkInAtSpot(SPOT, 'empty')).resolves.toEqual({ ok: false, reason: 'permission_denied' });
    expect(createBusynessReport).not.toHaveBeenCalled();
  });

  it('treats a server-side proximity rejection as too far', async () => {
    grantPermission();
    standAt(AT_SPOT);
    createBusynessReport.mockRejectedValue(new CheckInRejectedError('too_far'));

    await expect(checkInAtSpot(SPOT, 'empty')).resolves.toEqual({ ok: false, reason: 'too_far', distanceMeters: 0 });
  });

  it('reports other server errors as a failed check-in', async () => {
    grantPermission();
    standAt(AT_SPOT);
    createBusynessReport.mockRejectedValue(new Error('Network error'));

    await expect(checkInAtSpot(SPOT, 'empty')).resolves.toEqual({ ok: false, reason: 'failed' });
  });
});
