import { BUSYNESS_FRESHNESS_MINUTES } from '../../lib/busyness';
import { CheckInRejectedError, createBusynessReport, listBusynessReports } from '../busyness';

const AT_RIVERA = { latitude: 33.9741, longitude: -117.3282, accuracy: 10 };

describe('busyness mock API', () => {
  it('lists a spot\'s reports newest first', async () => {
    const reports = await listBusynessReports(1);

    expect(reports.length).toBeGreaterThan(0);
    expect(reports.every((report) => report.spot === 1)).toBe(true);
    const times = reports.map((report) => report.reported_at);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('creates a report and sets its expiry on the server side', async () => {
    const report = await createBusynessReport(1, { level: 'packed', ...AT_RIVERA });

    expect(report).toMatchObject({ spot: 1, level: 'packed' });
    const lifetime = new Date(report.expires_at).getTime() - new Date(report.reported_at).getTime();
    expect(lifetime).toBe(BUSYNESS_FRESHNESS_MINUTES * 60 * 1000);
    expect((await listBusynessReports(1))[0].id).toBe(report.id);
  });

  it('re-checks proximity instead of trusting the app', async () => {
    const request = createBusynessReport(1, { level: 'empty', latitude: 33.99, longitude: -117.3282, accuracy: 10 });

    await expect(request).rejects.toBeInstanceOf(CheckInRejectedError);
    await expect(request).rejects.toMatchObject({ code: 'too_far' });
  });

  it('rejects unknown levels and spots', async () => {
    await expect(createBusynessReport(1, { level: 'full', ...AT_RIVERA })).rejects.toMatchObject({ code: 'invalid_level' });
    await expect(createBusynessReport(999, { level: 'empty', ...AT_RIVERA })).rejects.toMatchObject({ code: 'spot_not_found' });
  });
});
