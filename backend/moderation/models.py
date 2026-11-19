from django.conf import settings
from django.db import models
from django.db.models import F, Q
from django.utils import timezone


class AccountModerationAction(models.Model):
    """Append-only history; the latest action determines the effective state."""

    class Action(models.TextChoices):
        SUSPEND = "suspend", "Suspend"
        BAN = "ban", "Ban"
        RESTORE = "restore", "Restore"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="account_moderation_actions",
    )
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="performed_account_moderation_actions",
    )
    action = models.CharField(max_length=10, choices=Action)
    reason = models.TextField(blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["user", "-created_at", "-id"], name="account_action_latest_idx")]
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(action="suspend", ends_at__isnull=False, ends_at__gt=F("created_at"))
                    | Q(action__in=["ban", "restore"], ends_at__isnull=True)
                ),
                name="account_action_expiry_valid",
            ),
            models.CheckConstraint(
                condition=Q(action="restore") | ~Q(reason=""),
                name="account_action_reason_required",
            ),
        ]


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
