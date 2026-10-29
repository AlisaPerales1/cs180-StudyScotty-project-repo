from datetime import timedelta

from django.apps import apps
from django.contrib import admin
from django.db import connection

from accounts.models import UserCourse, UserProfile
from moderation.models import AbuseReport, SessionCreationRestriction
from spots.models import BusynessReport, Favorite, Review, SpotPhoto
from study_sessions.models import RSVP, SessionCheckIn

from .testing import DomainTestCase


class SchemaIntegrationTests(DomainTestCase):
    def test_all_erd_tables_exist_and_are_registered_in_admin(self):
        domain_models = [
            model for label in ["accounts", "spots", "study_sessions", "moderation"]
            for model in apps.get_app_config(label).get_models()
        ]
        self.assertEqual(len(domain_models), 15)
        tables = connection.introspection.table_names()
        for model in domain_models:
            with self.subTest(model=model.__name__):
                self.assertIn(model._meta.db_table, tables)
                self.assertTrue(admin.site.is_registered(model))

    def test_full_relationship_graph_can_be_created_and_traversed(self):
        UserProfile.objects.create(user=self.member, study_preferences="Quiet spaces")
        UserCourse.objects.create(user=self.member, course=self.course)
        SpotPhoto.objects.create(spot=self.spot, uploader=self.member, storage_key="spots/photo.jpg")
        Review.objects.create(spot=self.spot, author=self.member, rating=5)
        Favorite.objects.create(spot=self.spot, user=self.member)
        report = BusynessReport.objects.create(
            spot=self.spot, reporter=self.member, level="some_seats",
            reported_at=self.start, expires_at=self.start + timedelta(hours=1),
        )
        RSVP.objects.create(session=self.session, user=self.member)
        checkin = SessionCheckIn(
            session=self.session, user=self.member, outcome="space_available", busyness_report=report,
        )
        checkin.full_clean()
        checkin.save()
        AbuseReport.objects.create(session=self.session, reporter=self.member, reason="Test report")
        SessionCreationRestriction.objects.create(
            user=self.user, reason="Test restriction", starts_at=self.start,
            ends_at=self.start + timedelta(days=1),
        )
        self.assertEqual(self.member.profile.study_preferences, "Quiet spaces")
        self.assertEqual(self.member.course_memberships.get().course, self.course)
        self.assertEqual(self.spot.photos.get().uploader, self.member)
        self.assertEqual(self.member.favorites.get().spot, self.session.spot)
        self.assertEqual(self.session.rsvps.get().user, self.member)
        self.assertEqual(self.session.check_ins.get().busyness_report, report)
        self.assertEqual(self.session.abuse_reports.get().reporter, self.member)
        self.assertEqual(self.user.session_creation_restrictions.count(), 1)
