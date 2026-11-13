from decimal import Decimal

from django.test import SimpleTestCase

from .proximity import CHECK_IN_RADIUS_METERS, check_proximity, distance_meters

RIVERA = (33.9741, -117.3282)
ORBACH = (33.9745, -117.3256)


def north_of_rivera(degrees, accuracy=None):
    """A position `degrees` of latitude north of Rivera Library (1e-3 degrees is about 111 m)."""
    return check_proximity(
        latitude=RIVERA[0] + degrees, longitude=RIVERA[1], accuracy=accuracy,
        target_latitude=Decimal("33.974100"), target_longitude=Decimal("-117.328200"),
    )


class DistanceTests(SimpleTestCase):
    def test_same_point_is_zero(self):
        self.assertEqual(distance_meters(*RIVERA, *RIVERA), 0)

    def test_campus_distance_and_symmetry(self):
        # Rivera Library to Orbach Science Library is roughly 240 m.
        self.assertTrue(230 < distance_meters(*RIVERA, *ORBACH) < 255)
        self.assertAlmostEqual(distance_meters(*RIVERA, *ORBACH), distance_meters(*ORBACH, *RIVERA))

    def test_accepts_model_decimals(self):
        self.assertAlmostEqual(
            distance_meters(Decimal("33.974100"), Decimal("-117.328200"), *ORBACH),
            distance_meters(*RIVERA, *ORBACH),
        )

    def test_thousandth_of_a_degree_of_latitude_is_about_111_m(self):
        self.assertAlmostEqual(distance_meters(*RIVERA, RIVERA[0] + 0.001, RIVERA[1]), 111.2, places=0)


class CheckProximityTests(SimpleTestCase):
    def test_radius_is_100_m(self):
        self.assertEqual(CHECK_IN_RADIUS_METERS, 100)

    def test_inside_and_outside_the_radius(self):
        inside = north_of_rivera(0.0008)
        outside = north_of_rivera(0.0012)
        self.assertEqual((inside.within, inside.distance_meters), (True, 89))
        self.assertEqual((outside.within, outside.distance_meters), (False, 133))

    def test_gps_accuracy_is_forgiven_up_to_50_m(self):
        self.assertTrue(north_of_rivera(0.0012, accuracy=40).within)  # 133 - 40 = 93 m
        self.assertTrue(north_of_rivera(0.0012, accuracy=500).within)  # capped: 133 - 50 = 83 m
        self.assertFalse(north_of_rivera(0.0016, accuracy=500).within)  # capped: 178 - 50 = 128 m

    def test_missing_or_negative_accuracy_gives_no_allowance(self):
        self.assertFalse(north_of_rivera(0.0012, accuracy=None).within)
        self.assertFalse(north_of_rivera(0.0012, accuracy=-20).within)

    def test_custom_radius(self):
        result = check_proximity(
            latitude=RIVERA[0] + 0.0012, longitude=RIVERA[1],
            target_latitude=RIVERA[0], target_longitude=RIVERA[1], radius_meters=150,
        )
        self.assertTrue(result.within)
