"""Shared fixtures and database-integrity assertions for model tests."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from accounts.models import Course
from spots.models import Spot
from study_sessions.models import StudySession


class DomainTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(username="host", email="host@ucr.edu")
        cls.member = get_user_model().objects.create_user(username="member", email="member@ucr.edu")
        cls.course = Course.objects.create(code="CS 010", name="Introduction to CS")
        cls.spot = Spot.objects.create(
            creator=cls.user, name="Campus lounge", latitude="33.973700", longitude="-117.328100",
        )
        cls.start = timezone.now() + timedelta(hours=1)
        cls.session = StudySession.objects.create(
            creator=cls.user, spot=cls.spot, course=cls.course,
            starts_at=cls.start, ends_at=cls.start + timedelta(hours=2), capacity=4,
        )

    def assert_database_rejects(self, operation):
        # A savepoint keeps the outer test transaction usable after a constraint failure.
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                operation()
