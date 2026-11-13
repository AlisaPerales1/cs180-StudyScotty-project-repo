from datetime import timedelta

from django.db.models import Avg, Count
from django.utils import timezone
from rest_framework import serializers

from common.proximity import CHECK_IN_RADIUS_METERS, check_proximity
from .models import BusynessReport, Review

# Provisional: the proposal says both about one and about two hours. One hour
# matches the mobile app until the team records a decision (see AGENTS.md).
BUSYNESS_REPORT_LIFETIME = timedelta(hours=1)


def current_busyness_reports(spot, *, now=None):
    now = now or timezone.now()
    return BusynessReport.objects.filter(spot=spot, reported_at__lte=now, expires_at__gt=now)


def busyness_summary(spot, *, now=None):
    """Latest unexpired level plus agreement counts; level None means Unknown."""
    reports = current_busyness_reports(spot, now=now)
    counts = {level: 0 for level in BusynessReport.Level.values}
    for row in reports.values("level").annotate(total=Count("id")):
        counts[row["level"]] = row["total"]
    latest = reports.order_by("-reported_at", "-id").first()
    return {
        "spot": spot.pk,
        "level": latest.level if latest else None,
        "reported_at": latest.reported_at if latest else None,
        "expires_at": latest.expires_at if latest else None,
        "report_count": sum(counts.values()),
        "counts": counts,
    }


def create_busyness_report(*, spot, reporter, level, latitude, longitude, accuracy=None):
    """Record a check-in after the shared proximity check; the server sets times."""
    result = check_proximity(
        latitude=latitude, longitude=longitude, accuracy=accuracy,
        target_latitude=spot.latitude, target_longitude=spot.longitude,
    )
    if not result.within:
        raise serializers.ValidationError({
            "location": [
                f"You are about {result.distance_meters} m from this spot. "
                f"Move within {CHECK_IN_RADIUS_METERS} m to report how busy it is."
            ],
        })
    reported_at = timezone.now()
    return BusynessReport.objects.create(
        spot=spot, reporter=reporter, level=level,
        reported_at=reported_at, expires_at=reported_at + BUSYNESS_REPORT_LIFETIME,
    )


def rating_summary(spot):
    reviews = Review.objects.filter(spot=spot)
    counts = {str(rating): 0 for rating in range(1, 6)}
    for row in reviews.values("rating").annotate(total=Count("id")):
        counts[str(row["rating"])] = row["total"]
    average = reviews.aggregate(average=Avg("rating"))["average"]
    return {
        "spot": spot.pk,
        "average": round(average, 2) if average is not None else None,
        "review_count": sum(counts.values()),
        "counts": counts,
    }
