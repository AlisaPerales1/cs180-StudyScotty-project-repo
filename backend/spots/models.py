from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q
from django.utils import timezone


def validate_timezone(value):
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValidationError("Enter a valid IANA timezone, such as America/Los_Angeles.")


class Spot(models.Model):
    class NoiseLevel(models.TextChoices):
        QUIET = "quiet", "Quiet"
        MODERATE = "moderate", "Moderate"
        LOUD = "loud", "Loud"

    class HoursStatus(models.TextChoices):
        UNKNOWN = "unknown", "Unknown"
        ALWAYS_ACCESSIBLE = "always_accessible", "Always accessible"
        SCHEDULED = "scheduled", "Scheduled"

    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_spots",
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    location_details = models.TextField(blank=True)
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )
    noise_level = models.CharField(max_length=20, choices=NoiseLevel, null=True, blank=True)
    has_outlets = models.BooleanField(null=True, blank=True)
    has_wifi = models.BooleanField(null=True, blank=True)
    is_indoor = models.BooleanField(null=True, blank=True)
    is_group_friendly = models.BooleanField(null=True, blank=True)
    hours_status = models.CharField(
        max_length=30, choices=HoursStatus, default=HoursStatus.UNKNOWN,
    )
    timezone = models.CharField(
        max_length=64, default="America/Los_Angeles", validators=[validate_timezone],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(latitude__gte=-90, latitude__lte=90), name="spot_latitude_range"),
            models.CheckConstraint(condition=Q(longitude__gte=-180, longitude__lte=180), name="spot_longitude_range"),
            models.CheckConstraint(condition=Q(noise_level__isnull=True) | Q(noise_level__in=["quiet", "moderate", "loud"]), name="spot_noise_valid"),
            models.CheckConstraint(condition=Q(hours_status__in=["unknown", "always_accessible", "scheduled"]), name="spot_hours_status_valid"),
        ]

    def __str__(self):
        return self.name


class SpotPhoto(models.Model):
    spot = models.ForeignKey(Spot, on_delete=models.CASCADE, related_name="photos")
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="spot_photos",
    )
    storage_key = models.CharField(max_length=500)
    caption = models.CharField(max_length=250, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class OpeningHours(models.Model):
    spot = models.ForeignKey(Spot, on_delete=models.CASCADE, related_name="opening_hours")
    weekday = models.PositiveSmallIntegerField(validators=[MaxValueValidator(6)])
    opens_at = models.TimeField()
    closes_at = models.TimeField()
    closes_next_day = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(weekday__gte=0, weekday__lte=6), name="opening_weekday_range"),
            models.CheckConstraint(
                condition=(Q(closes_next_day=False, closes_at__gt=F("opens_at"))
                           | Q(closes_next_day=True, closes_at__lte=F("opens_at"))),
                name="opening_interval_valid",
            ),
        ]


class Review(models.Model):
    spot = models.ForeignKey(Spot, on_delete=models.CASCADE, related_name="reviews")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="reviews",
    )
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(rating__gte=1, rating__lte=5), name="review_rating_range"),
        ]


class Favorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites")
    spot = models.ForeignKey(Spot, on_delete=models.CASCADE, related_name="favorites")
    opening_reminder_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "spot"], name="unique_user_favorite"),
        ]


class BusynessReport(models.Model):
    class Level(models.TextChoices):
        EMPTY = "empty", "Empty"
        SOME_SEATS = "some_seats", "Some seats"
        PACKED = "packed", "Packed"

    spot = models.ForeignKey(Spot, on_delete=models.CASCADE, related_name="busyness_reports")
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="busyness_reports",
    )
    level = models.CharField(max_length=20, choices=Level)
    reported_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(help_text="Supply explicitly until the freshness duration is agreed.")

    class Meta:
        indexes = [models.Index(fields=["spot", "reported_at"], name="busyness_spot_time_idx")]
        constraints = [
            models.CheckConstraint(condition=Q(level__in=["empty", "some_seats", "packed"]), name="busyness_level_valid"),
            models.CheckConstraint(condition=Q(expires_at__gt=F("reported_at")), name="busyness_expiry_after_report"),
        ]
