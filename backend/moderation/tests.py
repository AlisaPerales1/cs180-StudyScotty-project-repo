from datetime import timedelta

from django.db.models.deletion import ProtectedError

from common.testing import DomainTestCase
from .models import AbuseReport, SessionCreationRestriction


class ModerationIntegrityTests(DomainTestCase):
    def test_abuse_reports_preserve_referenced_session(self):
        AbuseReport.objects.create(session=self.session, reporter=self.member, reason="Fake session")
        with self.assertRaises(ProtectedError):
            self.session.delete()

    def test_abuse_report_status_and_reviewer_pair_are_constrained(self):
        report = AbuseReport.objects.create(session=self.session, reporter=self.member, reason="Fake session")
        for changes in [{"status": "invalid"}, {"reviewed_by": self.user}, {"reviewed_at": self.start}]:
            with self.subTest(changes=changes):
                self.assert_database_rejects(lambda: AbuseReport.objects.filter(pk=report.pk).update(**changes))
        report.status = AbuseReport.Status.REVIEWED
        report.reviewed_by = self.user
        report.reviewed_at = self.start
        report.save()

    def test_restriction_duration_and_lifter_pair_are_constrained(self):
        restriction = SessionCreationRestriction.objects.create(
            user=self.member, reason="Repeated no-shows", starts_at=self.start,
            ends_at=self.start + timedelta(days=1),
        )
        for changes in [{"ends_at": self.start}, {"lifted_by": self.user}, {"lifted_at": self.start}]:
            with self.subTest(changes=changes):
                self.assert_database_rejects(
                    lambda: SessionCreationRestriction.objects.filter(pk=restriction.pk).update(**changes),
                )
        restriction.lifted_by = self.user
        restriction.lifted_at = self.start
        restriction.save()
