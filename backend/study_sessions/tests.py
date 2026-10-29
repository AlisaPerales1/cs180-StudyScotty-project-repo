from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db.models.deletion import ProtectedError

from common.testing import DomainTestCase
from spots.models import BusynessReport, Spot
from .models import RSVP, SessionCheckIn, StudySession


class SessionIntegrityTests(DomainTestCase):
    def test_session_duration_capacity_and_state_are_constrained(self):
        for changes in [
            {"ends_at": self.start},
            {"ends_at": self.start + timedelta(hours=2, microseconds=1)},
            {"capacity": 0}, {"status": "invalid"},
        ]:
            with self.subTest(changes=changes):
                self.assert_database_rejects(
                    lambda: StudySession.objects.filter(pk=self.session.pk).update(**changes),
                )

    def test_rsvp_uniqueness_and_status(self):
        RSVP.objects.create(session=self.session, user=self.member)
        self.assert_database_rejects(lambda: RSVP.objects.create(session=self.session, user=self.member))
        self.assert_database_rejects(lambda: RSVP.objects.filter(session=self.session).update(status="invalid"))

    def test_valid_checkin_and_report_match(self):
        report = BusynessReport.objects.create(
            spot=self.spot, reporter=self.member, level="some_seats",
            reported_at=self.start, expires_at=self.start + timedelta(hours=1),
        )
        checkin = SessionCheckIn(
            session=self.session, user=self.member, outcome="space_available", busyness_report=report,
        )
        checkin.full_clean()
        checkin.save()
        self.assertEqual(checkin.busyness_report.spot_id, checkin.session.spot_id)
        self.assert_database_rejects(lambda: SessionCheckIn.objects.filter(pk=checkin.pk).update(outcome="invalid"))

    def test_checkin_validation_rejects_report_from_other_user_or_spot(self):
        other_spot = Spot.objects.create(creator=self.user, name="Other", latitude=0, longitude=0)
        for spot, user in [(self.spot, self.user), (other_spot, self.member)]:
            with self.subTest(spot=spot.pk, user=user.pk):
                report = BusynessReport.objects.create(
                    spot=spot, reporter=user, level="empty", reported_at=self.start,
                    expires_at=self.start + timedelta(hours=1),
                )
                checkin = SessionCheckIn(
                    session=self.session, user=self.member,
                    outcome="space_available", busyness_report=report,
                )
                with self.assertRaises(ValidationError):
                    checkin.full_clean()

    def test_missing_foreign_key_is_a_validation_error(self):
        checkin = SessionCheckIn(
            session_id=999999, user=self.member, outcome="space_available", busyness_report_id=999999,
        )
        with self.assertRaises(ValidationError):
            checkin.full_clean()

    def test_session_protects_spot_course_and_creator_from_deletion(self):
        for obj in [self.spot, self.course, self.user]:
            with self.subTest(model=type(obj).__name__):
                with self.assertRaises(ProtectedError):
                    obj.delete()

    def test_session_deletion_removes_rsvps_and_checkins(self):
        RSVP.objects.create(session=self.session, user=self.member)
        SessionCheckIn.objects.create(session=self.session, user=self.member, outcome="space_available")
        self.session.delete()
        self.assertFalse(RSVP.objects.exists())
        self.assertFalse(SessionCheckIn.objects.exists())
