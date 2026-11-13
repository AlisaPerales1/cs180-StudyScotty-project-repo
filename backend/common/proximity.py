"""Shared proximity check for busyness reports and session check-ins.

Positions are client-reported GPS readings, so this check deters casual misuse
rather than proving presence. The radius and the GPS accuracy allowance are
provisional until the team records final values in docs/api-contract.md. The
mobile app mirrors these values in mobile/src/lib/proximity.js for instant
feedback; this module is authoritative.
"""

import math
from dataclasses import dataclass

EARTH_RADIUS_METERS = 6_371_000
CHECK_IN_RADIUS_METERS = 100
# Most of a reading's reported GPS error that is forgiven, so indoor fixes still count.
MAX_ACCURACY_ALLOWANCE_METERS = 50


@dataclass(frozen=True)
class ProximityResult:
    within: bool
    distance_meters: int


def distance_meters(lat1, lng1, lat2, lng2):
    """Great-circle (haversine) distance in meters; accepts floats or Decimals."""
    phi1, phi2 = math.radians(float(lat1)), math.radians(float(lat2))
    d_phi = phi2 - phi1
    d_lambda = math.radians(float(lng2) - float(lng1))
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_METERS * math.asin(min(1.0, math.sqrt(a)))


def check_proximity(*, latitude, longitude, target_latitude, target_longitude,
                    accuracy=None, radius_meters=CHECK_IN_RADIUS_METERS):
    """Whether a reported position is close enough to a target location."""
    distance = distance_meters(latitude, longitude, target_latitude, target_longitude)
    allowance = min(max(accuracy or 0, 0), MAX_ACCURACY_ALLOWANCE_METERS)
    return ProximityResult(within=distance - allowance <= radius_meters, distance_meters=round(distance))
