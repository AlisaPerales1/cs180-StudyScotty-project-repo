from datetime import time, timedelta

from django.core.exceptions import ValidationError

from common.testing import DomainTestCase
from .models import BusynessReport, Favorite, OpeningHours, Review, Spot


class SpotIntegrityTests(DomainTestCase):
    def test_unknown_amenities_and_hours_remain_unknown(self):
        self.assertIsNone(self.spot.has_wifi)
        self.assertIsNone(self.spot.has_outlets)
        self.assertIsNone(self.spot.noise_level)
        self.assertEqual(self.spot.hours_status, Spot.HoursStatus.UNKNOWN)

    def test_invalid_coordinates_and_choices_are_rejected_by_database(self):
        for field, value in [
            ("latitude", "90.000001"), ("latitude", "-90.000001"),
            ("longitude", "180.000001"), ("longitude", "-180.000001"),
            ("noise_level", "invalid"), ("hours_status", "invalid"),
        ]:
            with self.subTest(field=field, value=value):
                self.assert_database_rejects(
                    lambda: Spot.objects.filter(pk=self.spot.pk).update(**{field: value}),
                )

    def test_timezone_validation(self):
        self.spot.timezone = "Not/AZone"
        with self.assertRaises(ValidationError):
            self.spot.full_clean()

    def test_duplicate_favorite_is_rejected(self):
        Favorite.objects.create(user=self.member, spot=self.spot)
        self.assert_database_rejects(lambda: Favorite.objects.create(user=self.member, spot=self.spot))

    def test_review_rating_bounds_and_pending_uniqueness_policy(self):
        for rating in [1, 5]:
            Review.objects.create(spot=self.spot, author=self.member, rating=rating)
        for rating in [0, 6]:
            with self.subTest(rating=rating):
                self.assert_database_rejects(
                    lambda: Review.objects.create(spot=self.spot, author=self.member, rating=rating),
                )
        self.assertEqual(self.spot.reviews.count(), 2)

    def test_opening_hours_support_daytime_and_overnight(self):
        for opens, closes, next_day in [(9, 17, False), (22, 2, True), (0, 0, True)]:
            OpeningHours.objects.create(
                spot=self.spot, weekday=0, opens_at=time(opens),
                closes_at=time(closes), closes_next_day=next_day,
            )
        for weekday, opens, closes, next_day in [
            (7, 9, 17, False), (0, 17, 9, False), (0, 9, 9, False), (0, 9, 17, True),
        ]:
            with self.subTest(weekday=weekday, opens=opens, closes=closes, next_day=next_day):
                self.assert_database_rejects(lambda: OpeningHours.objects.create(
                    spot=self.spot, weekday=weekday, opens_at=time(opens),
                    closes_at=time(closes), closes_next_day=next_day,
                ))

    def test_busyness_requires_valid_level_and_later_expiration(self):
        for level, expires in [("invalid", self.start + timedelta(hours=1)), ("empty", self.start)]:
            with self.subTest(level=level, expires=expires):
                self.assert_database_rejects(lambda: BusynessReport.objects.create(
                    spot=self.spot, reporter=self.member, level=level,
                    reported_at=self.start, expires_at=expires,
                ))
