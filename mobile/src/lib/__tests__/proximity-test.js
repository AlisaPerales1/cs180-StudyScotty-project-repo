import { CHECK_IN_RADIUS_METERS, checkProximity, distanceMeters } from '../proximity';

const RIVERA = { latitude: '33.974100', longitude: '-117.328200' };
const ORBACH = { latitude: '33.974500', longitude: '-117.325600' };

/** A point `degrees` of latitude north of Rivera Library (1e-3 degrees ≈ 111 m). */
const northOfRivera = (degrees, accuracy = 0) => ({
  latitude: Number(RIVERA.latitude) + degrees,
  longitude: Number(RIVERA.longitude),
  accuracy,
});

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters(RIVERA, RIVERA)).toBe(0);
  });

  it('accepts the decimal strings the API returns as well as numbers', () => {
    expect(distanceMeters(RIVERA, ORBACH))
      .toBeCloseTo(distanceMeters({ latitude: 33.9741, longitude: -117.3282 }, { latitude: 33.9745, longitude: -117.3256 }), 6);
  });

  it('measures real distances across campus', () => {
    // Rivera Library to Orbach Science Library is roughly 240 m.
    expect(distanceMeters(RIVERA, ORBACH)).toBeGreaterThan(230);
    expect(distanceMeters(RIVERA, ORBACH)).toBeLessThan(255);
  });

  it('is symmetric', () => {
    expect(distanceMeters(RIVERA, ORBACH)).toBeCloseTo(distanceMeters(ORBACH, RIVERA), 6);
  });

  it('matches about 111 m per thousandth of a degree of latitude', () => {
    expect(distanceMeters(RIVERA, northOfRivera(0.001))).toBeCloseTo(111.2, 0);
  });
});

describe('checkProximity', () => {
  it('uses a 100 m check-in radius', () => {
    expect(CHECK_IN_RADIUS_METERS).toBe(100);
  });

  it('accepts positions inside the radius', () => {
    expect(checkProximity(northOfRivera(0.0008), RIVERA)).toEqual({ within: true, distanceMeters: 89 });
  });

  it('rejects positions outside the radius and reports the distance', () => {
    expect(checkProximity(northOfRivera(0.0012), RIVERA)).toEqual({ within: false, distanceMeters: 133 });
  });

  it('forgives the GPS accuracy error, so a fuzzy indoor fix still counts', () => {
    // 133 m away, but the phone says it may be off by 40 m.
    expect(checkProximity(northOfRivera(0.0012, 40), RIVERA).within).toBe(true);
  });

  it('caps the accuracy allowance at 50 m so very rough fixes cannot check in from far away', () => {
    expect(checkProximity(northOfRivera(0.0012, 500), RIVERA).within).toBe(true); // 133 - 50 = 83 m
    expect(checkProximity(northOfRivera(0.0016, 500), RIVERA).within).toBe(false); // 178 - 50 = 128 m
  });

  it('treats a missing or invalid accuracy as no allowance', () => {
    expect(checkProximity(northOfRivera(0.0012, null), RIVERA).within).toBe(false);
    expect(checkProximity(northOfRivera(0.0012, -20), RIVERA).within).toBe(false);
  });

  it('supports a custom radius', () => {
    expect(checkProximity(northOfRivera(0.0012), RIVERA, 150).within).toBe(true);
  });
});
