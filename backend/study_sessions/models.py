from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F, Q
from django.utils import timezone


class StudySession(models.Model):
    class Status(models.TextChoices):
        UPCOMING = "upcoming", "Upcoming"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        NO_SHOW = "no_show", "No-show"

    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_study_sessions",
    )
    spot = models.ForeignKey("spots.Spot", on_delete=models.PROTECT, related_name="study_sessions")
    course = models.ForeignKey("accounts.Course", on_delete=models.PROTECT, related_name="study_sessions")
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    capacity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    status = models.CharField(max_length=30, choices=Status, default=Status.UPCOMING)
    cancellation_reason = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["spot", "starts_at"], name="session_spot_start_idx"),
            models.Index(fields=["course", "starts_at"], name="session_course_start_idx"),
            models.Index(fields=["creator", "status"], name="session_creator_status_idx"),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(capacity__gte=1), name="session_capacity_positive"),
            models.CheckConstraint(condition=Q(ends_at__gt=F("starts_at")), name="session_end_after_start"),
            models.CheckConstraint(condition=Q(ends_at__lte=F("starts_at") + timedelta(hours=2)), name="session_max_two_hours"),
            models.CheckConstraint(condition=Q(status__in=["upcoming", "in_progress", "completed", "cancelled", "no_show"]), name="session_status_valid"),
        ]


class RSVP(models.Model):
    class Status(models.TextChoices):
        GOING = "going", "Going"
        CANCELLED = "cancelled", "Cancelled"

    session = models.ForeignKey(StudySession, on_delete=models.CASCADE, related_name="rsvps")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="rsvps")
    status = models.CharField(max_length=20, choices=Status, default=Status.GOING)
    reminder_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["session", "user"], name="unique_session_rsvp"),
            models.CheckConstraint(condition=Q(status__in=["going", "cancelled"]), name="rsvp_status_valid"),
        ]


class SessionCheckIn(models.Model):
    class Outcome(models.TextChoices):
        SPACE_AVAILABLE = "space_available", "Space available"
        SPOT_FULL = "spot_full", "Spot full"

    session = models.ForeignKey(StudySession, on_delete=models.CASCADE, related_name="check_ins")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="session_check_ins")
    outcome = models.CharField(max_length=20, choices=Outcome)
    busyness_report = models.ForeignKey(
        "spots.BusynessReport", on_delete=models.PROTECT,
        null=True, blank=True, related_name="session_check_ins",
    )
    checked_in_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(outcome__in=["space_available", "spot_full"]), name="checkin_outcome_valid"),
        ]

    def clean(self):
        super().clean()
        if self.busyness_report_id and self.session_id and self.user_id:
            try:
                report = self.busyness_report
                spot_id = self.session.spot_id
            except ObjectDoesNotExist:
                # full_clean() reports invalid foreign keys through clean_fields().
                return
            if report.spot_id != spot_id or report.reporter_id != self.user_id:
                raise ValidationError({
                    "busyness_report": "The report must match the session spot and check-in user.",
                })
