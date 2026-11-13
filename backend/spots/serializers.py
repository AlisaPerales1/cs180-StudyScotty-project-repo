import math
from collections.abc import Mapping

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import BusynessReport, Favorite, OpeningHours, Review, Spot

REVIEW_COMMENT_MAX_LENGTH = 2000


class RejectUnknownFieldsMixin:
    """Reject unknown and read-only keys instead of silently ignoring them."""

    def to_internal_value(self, data):
        if isinstance(data, Mapping):
            errors = {}
            for key in data:
                if key not in self.fields:
                    errors[key] = ["Unknown field."]
                elif self.fields[key].read_only:
                    errors[key] = ["This field is read-only."]
            if errors:
                raise serializers.ValidationError(errors)
        return super().to_internal_value(data)


class StrictCharField(serializers.CharField):
    def to_internal_value(self, data):
        if not isinstance(data, str):
            self.fail("invalid")
        return super().to_internal_value(data)


class StrictIntegerField(serializers.IntegerField):
    def to_internal_value(self, data):
        if isinstance(data, bool) or not isinstance(data, int):
            self.fail("invalid")
        return super().to_internal_value(data)


class StrictFloatField(serializers.FloatField):
    def to_internal_value(self, data):
        if isinstance(data, bool) or not isinstance(data, (int, float)) or not math.isfinite(data):
            self.fail("invalid")
        return super().to_internal_value(data)


class StrictBooleanField(serializers.BooleanField):
    def to_internal_value(self, data):
        if not isinstance(data, bool):
            self.fail("invalid", input=data)
        return data


class ReviewAuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ("username", "first_name", "last_name")


class ReviewSerializer(RejectUnknownFieldsMixin, serializers.ModelSerializer):
    author = ReviewAuthorSerializer(read_only=True)
    rating = StrictIntegerField(min_value=1, max_value=5)
    comment = StrictCharField(
        allow_blank=True, required=False, default="", max_length=REVIEW_COMMENT_MAX_LENGTH,
    )
    is_author = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ("id", "spot", "author", "rating", "comment", "created_at", "updated_at", "is_author")
        read_only_fields = ("id", "spot", "created_at", "updated_at")

    def get_is_author(self, review):
        request = self.context.get("request")
        return bool(request and review.author_id == request.user.pk)


class SpotSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Spot
        fields = ("id", "name")


class FavoriteSerializer(RejectUnknownFieldsMixin, serializers.ModelSerializer):
    spot = SpotSummarySerializer(read_only=True)
    opening_reminder_enabled = StrictBooleanField(required=False)

    class Meta:
        model = Favorite
        fields = ("spot", "opening_reminder_enabled", "created_at")
        read_only_fields = ("created_at",)


class BusynessReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusynessReport
        fields = ("id", "spot", "level", "reported_at", "expires_at")
        read_only_fields = fields


class BusynessCheckInSerializer(RejectUnknownFieldsMixin, serializers.Serializer):
    """Check-in input. Coordinates are used for the proximity check and not stored."""

    level = serializers.ChoiceField(choices=BusynessReport.Level.choices)
    latitude = StrictFloatField(min_value=-90, max_value=90)
    longitude = StrictFloatField(min_value=-180, max_value=180)
    accuracy = StrictFloatField(min_value=0, required=False, allow_null=True)


class OpeningHoursSerializer(serializers.ModelSerializer):
    class Meta:
        model = OpeningHours
        fields = ("weekday", "opens_at", "closes_at", "closes_next_day")


class SpotHoursSerializer(serializers.ModelSerializer):
    spot = serializers.IntegerField(source="pk", read_only=True)
    opening_hours = serializers.SerializerMethodField()

    class Meta:
        model = Spot
        fields = ("spot", "hours_status", "timezone", "opening_hours")

    def get_opening_hours(self, spot):
        # Intervals only apply to scheduled spots; others report none.
        if spot.hours_status != Spot.HoursStatus.SCHEDULED:
            return []
        hours = spot.opening_hours.order_by("weekday", "opens_at", "id")
        return OpeningHoursSerializer(hours, many=True).data
