from datetime import time, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import BusynessReport, Favorite, OpeningHours, Review, Spot
from .services import BUSYNESS_REPORT_LIFETIME

AT_SPOT = {"latitude": 33.9741, "longitude": -117.3282, "accuracy": 10}


class SpotEndpointTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        users = get_user_model().objects
        cls.user = users.create_user(username="scotty", email="scotty@ucr.edu", first_name="Scotty", last_name="Highlander")
        cls.other = users.create_user(username="other", email="other@ucr.edu")
        cls.spot = Spot.objects.create(
            creator=cls.user, name="Rivera Library", latitude="33.974100", longitude="-117.328200",
            hours_status=Spot.HoursStatus.SCHEDULED,
        )
        cls.other_spot = Spot.objects.create(
            creator=cls.user, name="Orbach Science Library", latitude="33.974500", longitude="-117.325600",
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def as_other(self):
        self.client.force_authenticate(self.other)

    def assert_anonymous_and_disabled_users_are_rejected(self, method, url, data=None):
        anonymous = APIClient()
        self.assertEqual(getattr(anonymous, method)(url, data, format="json").status_code, 403)
        disabled = get_user_model().objects.create_user(username=f"off-{method}", email=f"off-{method}@ucr.edu", is_active=False)
        client = APIClient()
        client.force_authenticate(disabled)
        self.assertEqual(getattr(client, method)(url, data, format="json").status_code, 403)


class ReviewEndpointTests(SpotEndpointTestCase):
    def url(self, spot=None):
        return f"/api/v1/spots/{(spot or self.spot).pk}/reviews/"

    def review(self, author, rating, comment="", spot=None):
        return Review.objects.create(spot=spot or self.spot, author=author, rating=rating, comment=comment)

    def test_create_review_sets_author_and_spot_from_the_request(self):
        response = self.client.post(self.url(), {"rating": 4, "comment": "  Quiet upstairs.  "}, format="json")

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["rating"], 4)
        self.assertEqual(body["comment"], "Quiet upstairs.")
        self.assertEqual(body["spot"], self.spot.pk)
        self.assertEqual(body["author"], {"username": "scotty", "first_name": "Scotty", "last_name": "Highlander"})
        self.assertTrue(body["is_author"])
        review = Review.objects.get()
        self.assertEqual((review.author, review.spot), (self.user, self.spot))

    def test_comment_is_optional(self):
        response = self.client.post(self.url(), {"rating": 5}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["comment"], "")

    def test_invalid_ratings_are_rejected(self):
        for rating in (0, 6, "4", True, 4.5, None):
            with self.subTest(rating=rating):
                response = self.client.post(self.url(), {"rating": rating}, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertIn("rating", response.json())
        self.assertEqual(self.client.post(self.url(), {}, format="json").status_code, 400)
        self.assertFalse(Review.objects.exists())

    def test_invalid_comments_and_extra_fields_are_rejected(self):
        cases = [
            {"rating": 3, "comment": 12},
            {"rating": 3, "comment": "x" * 2001},
            {"rating": 3, "author": self.other.pk},
            {"rating": 3, "spot": self.other_spot.pk},
            {"rating": 3, "stars": 3},
        ]
        for data in cases:
            with self.subTest(data=data):
                self.assertEqual(self.client.post(self.url(), data, format="json").status_code, 400)
        self.assertFalse(Review.objects.exists())

    def test_form_data_is_unsupported(self):
        self.assertEqual(self.client.post(self.url(), {"rating": 3}).status_code, 415)

    def test_same_user_may_review_a_spot_more_than_once_while_policy_is_pending(self):
        self.client.post(self.url(), {"rating": 4}, format="json")
        self.assertEqual(self.client.post(self.url(), {"rating": 2}, format="json").status_code, 201)

    def test_list_is_newest_first_paginated_and_scoped_to_the_spot(self):
        older = self.review(self.other, 3, "Older")
        Review.objects.filter(pk=older.pk).update(created_at=timezone.now() - timedelta(days=1))
        newer = self.review(self.user, 5, "Newer")
        self.review(self.user, 1, spot=self.other_spot)

        body = self.client.get(self.url()).json()

        self.assertEqual(body["count"], 2)
        self.assertEqual([item["id"] for item in body["results"]], [newer.pk, older.pk])
        self.assertEqual([item["is_author"] for item in body["results"]], [True, False])

    def test_unknown_spot_returns_404(self):
        self.assertEqual(self.client.get("/api/v1/spots/9999/reviews/").status_code, 404)
        self.assertEqual(self.client.post("/api/v1/spots/9999/reviews/", {"rating": 3}, format="json").status_code, 404)

    def test_requires_an_active_account(self):
        self.assert_anonymous_and_disabled_users_are_rejected("get", self.url())
        self.assert_anonymous_and_disabled_users_are_rejected("post", self.url(), {"rating": 3})

    def test_summary_reports_average_and_star_counts(self):
        for rating in (5, 4, 4, 3):
            self.review(self.other, rating)
        self.review(self.other, 1, spot=self.other_spot)

        response = self.client.get(f"{self.url()}summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "spot": self.spot.pk, "average": 4.0, "review_count": 4,
            "counts": {"1": 0, "2": 0, "3": 1, "4": 2, "5": 1},
        })

    def test_summary_of_unreviewed_spot_has_no_average(self):
        body = self.client.get(f"{self.url()}summary/").json()
        self.assertIsNone(body["average"])
        self.assertEqual(body["review_count"], 0)

    def test_author_can_edit_part_of_their_review(self):
        review = self.review(self.user, 2, "Too loud")

        response = self.client.patch(f"/api/v1/spots/reviews/{review.pk}/", {"rating": 3}, format="json")

        self.assertEqual(response.status_code, 200)
        review.refresh_from_db()
        self.assertEqual((review.rating, review.comment), (3, "Too loud"))

    def test_others_cannot_edit_or_delete_a_review(self):
        review = self.review(self.user, 2)
        self.as_other()
        url = f"/api/v1/spots/reviews/{review.pk}/"
        self.assertEqual(self.client.patch(url, {"rating": 5}, format="json").status_code, 403)
        self.assertEqual(self.client.delete(url).status_code, 403)
        review.refresh_from_db()
        self.assertEqual(review.rating, 2)

    def test_author_can_delete_their_review(self):
        review = self.review(self.user, 2)
        self.assertEqual(self.client.delete(f"/api/v1/spots/reviews/{review.pk}/").status_code, 204)
        self.assertFalse(Review.objects.exists())

    def test_edit_validation_and_unsupported_methods(self):
        review = self.review(self.user, 2)
        url = f"/api/v1/spots/reviews/{review.pk}/"
        self.assertEqual(self.client.patch(url, {"rating": 9}, format="json").status_code, 400)
        self.assertEqual(self.client.patch(url, {"spot": self.other_spot.pk}, format="json").status_code, 400)
        self.assertEqual(self.client.put(url, {"rating": 3}, format="json").status_code, 405)
        self.assertEqual(self.client.patch("/api/v1/spots/reviews/9999/", {"rating": 3}, format="json").status_code, 404)


class FavoriteEndpointTests(SpotEndpointTestCase):
    def url(self, spot=None):
        return f"/api/v1/spots/{(spot or self.spot).pk}/favorite/"

    def test_put_creates_a_favorite_with_the_reminder_off(self):
        response = self.client.put(self.url(), {}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["spot"], {"id": self.spot.pk, "name": "Rivera Library"})
        self.assertFalse(response.json()["opening_reminder_enabled"])
        self.assertTrue(Favorite.objects.filter(user=self.user, spot=self.spot).exists())

    def test_put_is_idempotent_and_keeps_one_favorite_per_spot(self):
        self.client.put(self.url(), {"opening_reminder_enabled": True}, format="json")
        response = self.client.put(self.url(), {}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["opening_reminder_enabled"])
        self.assertEqual(Favorite.objects.count(), 1)

    def test_put_updates_the_opening_reminder(self):
        self.client.put(self.url(), {"opening_reminder_enabled": True}, format="json")
        response = self.client.put(self.url(), {"opening_reminder_enabled": False}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(Favorite.objects.get().opening_reminder_enabled)

    def test_get_reports_whether_a_spot_is_a_favorite(self):
        self.assertEqual(self.client.get(self.url()).status_code, 404)
        self.client.put(self.url(), {}, format="json")
        self.assertEqual(self.client.get(self.url()).status_code, 200)

    def test_delete_is_idempotent_and_only_affects_the_current_user(self):
        Favorite.objects.create(user=self.other, spot=self.spot)
        self.client.put(self.url(), {}, format="json")

        self.assertEqual(self.client.delete(self.url()).status_code, 204)
        self.assertEqual(self.client.delete(self.url()).status_code, 204)
        self.assertEqual(list(Favorite.objects.values_list("user__username", flat=True)), ["other"])

    def test_invalid_bodies_are_rejected(self):
        for data in ({"opening_reminder_enabled": "true"}, {"opening_reminder_enabled": 1}, {"user": self.other.pk}, {"created_at": "2026-01-01T00:00:00Z"}):
            with self.subTest(data=data):
                self.assertEqual(self.client.put(self.url(), data, format="json").status_code, 400)
        self.assertFalse(Favorite.objects.exists())

    def test_list_shows_only_my_favorites_newest_first(self):
        older = Favorite.objects.create(user=self.user, spot=self.spot)
        Favorite.objects.filter(pk=older.pk).update(created_at=timezone.now() - timedelta(days=1))
        Favorite.objects.create(user=self.user, spot=self.other_spot, opening_reminder_enabled=True)
        Favorite.objects.create(user=self.other, spot=self.spot)

        body = self.client.get("/api/v1/spots/favorites/").json()

        self.assertEqual(body["count"], 2)
        self.assertEqual([item["spot"]["name"] for item in body["results"]], ["Orbach Science Library", "Rivera Library"])
        self.assertEqual([item["opening_reminder_enabled"] for item in body["results"]], [True, False])

    def test_unknown_spot_and_unsupported_methods(self):
        self.assertEqual(self.client.put("/api/v1/spots/9999/favorite/", {}, format="json").status_code, 404)
        self.assertEqual(self.client.post(self.url(), {}, format="json").status_code, 405)
        self.assertEqual(self.client.post("/api/v1/spots/favorites/", {}, format="json").status_code, 405)

    def test_requires_an_active_account(self):
        self.assert_anonymous_and_disabled_users_are_rejected("put", self.url(), {})
        self.assert_anonymous_and_disabled_users_are_rejected("get", "/api/v1/spots/favorites/")


class BusynessEndpointTests(SpotEndpointTestCase):
    def url(self, spot=None):
        return f"/api/v1/spots/{(spot or self.spot).pk}/busyness/"

    def report(self, level, minutes_ago, spot=None, reporter=None):
        reported_at = timezone.now() - timedelta(minutes=minutes_ago)
        return BusynessReport.objects.create(
            spot=spot or self.spot, reporter=reporter or self.other, level=level,
            reported_at=reported_at, expires_at=reported_at + BUSYNESS_REPORT_LIFETIME,
        )

    def test_spot_without_current_reports_is_unknown(self):
        self.report("packed", 90)  # expired

        response = self.client.get(self.url())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "spot": self.spot.pk, "level": None, "reported_at": None, "expires_at": None,
            "report_count": 0, "counts": {"empty": 0, "some_seats": 0, "packed": 0},
        })

    def test_summary_uses_the_latest_current_report_and_counts_agreement(self):
        self.report("packed", 40)
        latest = self.report("some_seats", 5)
        self.report("packed", 20)
        self.report("empty", 75)  # expired
        self.report("empty", 1, spot=self.other_spot)

        body = self.client.get(self.url()).json()

        self.assertEqual(body["level"], "some_seats")
        self.assertEqual(body["reported_at"], latest.reported_at.isoformat().replace("+00:00", "Z"))
        self.assertEqual(body["report_count"], 3)
        self.assertEqual(body["counts"], {"empty": 0, "some_seats": 1, "packed": 2})

    def test_check_in_at_the_spot_creates_a_report_with_server_set_times(self):
        before = timezone.now()
        response = self.client.post(self.url(), {"level": "packed", **AT_SPOT}, format="json")

        self.assertEqual(response.status_code, 201)
        report = BusynessReport.objects.get()
        self.assertEqual((report.reporter, report.spot, report.level), (self.user, self.spot, "packed"))
        self.assertGreaterEqual(report.reported_at, before)
        self.assertEqual(report.expires_at - report.reported_at, timedelta(hours=1))
        self.assertEqual(set(response.json()), {"id", "spot", "level", "reported_at", "expires_at"})
        self.assertEqual(self.client.get(self.url()).json()["level"], "packed")

    def test_check_in_from_too_far_away_is_rejected(self):
        response = self.client.post(
            self.url(), {"level": "empty", "latitude": 33.98, "longitude": -117.3282, "accuracy": 10}, format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("about 656 m", response.json()["location"][0])
        self.assertFalse(BusynessReport.objects.exists())

    def test_gps_accuracy_allowance_applies(self):
        nearby = {"level": "empty", "latitude": 33.9741 + 0.0012, "longitude": -117.3282}
        self.assertEqual(self.client.post(self.url(), nearby, format="json").status_code, 400)
        self.assertEqual(self.client.post(self.url(), {**nearby, "accuracy": 40}, format="json").status_code, 201)

    def test_invalid_check_ins_are_rejected(self):
        cases = [
            {"level": "full", **AT_SPOT},
            {**AT_SPOT},
            {"level": "empty", "latitude": "33.9741", "longitude": -117.3282},
            {"level": "empty", "latitude": True, "longitude": -117.3282},
            {"level": "empty", "latitude": 91, "longitude": -117.3282},
            {"level": "empty", "latitude": 33.9741},
            {"level": "empty", **AT_SPOT, "accuracy": -1},
            {"level": "empty", **AT_SPOT, "expires_at": "2030-01-01T00:00:00Z"},
            {"level": "empty", **AT_SPOT, "reporter": self.other.pk},
        ]
        for data in cases:
            with self.subTest(data=data):
                self.assertEqual(self.client.post(self.url(), data, format="json").status_code, 400)
        self.assertFalse(BusynessReport.objects.exists())

    def test_accuracy_may_be_null_or_omitted(self):
        self.assertEqual(self.client.post(self.url(), {"level": "empty", "latitude": 33.9741, "longitude": -117.3282, "accuracy": None}, format="json").status_code, 201)
        self.assertEqual(self.client.post(self.url(), {"level": "empty", "latitude": 33.9741, "longitude": -117.3282}, format="json").status_code, 201)

    def test_unknown_spot_and_unsupported_methods(self):
        self.assertEqual(self.client.get("/api/v1/spots/9999/busyness/").status_code, 404)
        self.assertEqual(self.client.put(self.url(), {"level": "empty", **AT_SPOT}, format="json").status_code, 405)

    def test_requires_an_active_account(self):
        self.assert_anonymous_and_disabled_users_are_rejected("get", self.url())
        self.assert_anonymous_and_disabled_users_are_rejected("post", self.url(), {"level": "empty", **AT_SPOT})


class HoursEndpointTests(SpotEndpointTestCase):
    def url(self, spot=None):
        return f"/api/v1/spots/{(spot or self.spot).pk}/hours/"

    def test_scheduled_spot_lists_intervals_in_weekly_order(self):
        OpeningHours.objects.create(spot=self.spot, weekday=4, opens_at=time(20), closes_at=time(2), closes_next_day=True)
        OpeningHours.objects.create(spot=self.spot, weekday=0, opens_at=time(13), closes_at=time(20))
        OpeningHours.objects.create(spot=self.spot, weekday=0, opens_at=time(8), closes_at=time(12))

        response = self.client.get(self.url())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "spot": self.spot.pk,
            "hours_status": "scheduled",
            "timezone": "America/Los_Angeles",
            "opening_hours": [
                {"weekday": 0, "opens_at": "08:00:00", "closes_at": "12:00:00", "closes_next_day": False},
                {"weekday": 0, "opens_at": "13:00:00", "closes_at": "20:00:00", "closes_next_day": False},
                {"weekday": 4, "opens_at": "20:00:00", "closes_at": "02:00:00", "closes_next_day": True},
            ],
        })

    def test_unscheduled_spots_report_no_intervals(self):
        OpeningHours.objects.create(spot=self.other_spot, weekday=0, opens_at=time(8), closes_at=time(12))
        body = self.client.get(self.url(self.other_spot)).json()
        self.assertEqual((body["hours_status"], body["opening_hours"]), ("unknown", []))

        Spot.objects.filter(pk=self.other_spot.pk).update(hours_status=Spot.HoursStatus.ALWAYS_ACCESSIBLE)
        body = self.client.get(self.url(self.other_spot)).json()
        self.assertEqual((body["hours_status"], body["opening_hours"]), ("always_accessible", []))

    def test_read_only_and_unknown_spot(self):
        self.assertEqual(self.client.post(self.url(), {}, format="json").status_code, 405)
        self.assertEqual(self.client.get("/api/v1/spots/9999/hours/").status_code, 404)
