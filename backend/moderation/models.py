from django.conf import settings
from django.db import models
from django.db.models import F, Q


class AbuseReport(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        REVIEWED = "reviewed", "Reviewed"
        DISMISSED = "dismissed", "Dismissed"

    session = models.ForeignKey("study_sessions.StudySession", on_delete=models.PROTECT, related_name="abuse_reports")
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="abuse_reports")
    reason = models.CharField(max_length=100)
    details = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status, default=Status.PENDING)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        null=True, blank=True, related_name="reviewed_abuse_reports",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(status__in=["pending", "reviewed", "dismissed"]), name="abuse_status_valid"),
            models.CheckConstraint(
                condition=(Q(reviewed_by__isnull=True, reviewed_at__isnull=True)
                           | Q(reviewed_by__isnull=False, reviewed_at__isnull=False)),
                name="abuse_reviewer_time_pair",
            ),
        ]


class SessionCreationRestriction(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="session_creation_restrictions")
    reason = models.TextField()
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    lifted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        null=True, blank=True, related_name="lifted_session_restrictions",
    )
    lifted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(ends_at__gt=F("starts_at")), name="restriction_end_after_start"),
            models.CheckConstraint(
                condition=(Q(lifted_by__isnull=True, lifted_at__isnull=True)
                           | Q(lifted_by__isnull=False, lifted_at__isnull=False)),
                name="restriction_lifter_time_pair",
            ),
        ]
