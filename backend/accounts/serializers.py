from collections.abc import Mapping

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import UserProfile


class ProfileSerializer(serializers.ModelSerializer):
    study_preferences = serializers.CharField(
        source="profile.study_preferences", allow_blank=True, required=False, default="",
    )

    class Meta:
        model = get_user_model()
        fields = ("username", "email", "first_name", "last_name", "study_preferences")
        read_only_fields = ("email",)

    def to_internal_value(self, data):
        if isinstance(data, Mapping):
            errors = {}
            for key, value in data.items():
                if key not in self.fields:
                    errors[key] = ["Unknown field."]
                elif self.fields[key].read_only:
                    errors[key] = ["This field is read-only."]
                elif value is not None and not isinstance(value, str):
                    errors[key] = ["Must be a string."]
            if errors:
                raise serializers.ValidationError(errors)
        return super().to_internal_value(data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # select_related caches an absent reverse one-to-one relation as None.
        if data["study_preferences"] is None:
            data["study_preferences"] = ""
        return data

    def update(self, instance, validated_data):
        # The view locks the user and wraps both tables in one transaction.
        profile_data = validated_data.pop("profile", None)
        changed_fields = list(validated_data)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if changed_fields:
            instance.save(update_fields=changed_fields)
        if profile_data is not None:
            profile, _ = UserProfile.objects.get_or_create(user=instance)
            profile.study_preferences = profile_data["study_preferences"]
            profile.save(update_fields=["study_preferences", "updated_at"])
            instance.profile = profile
        return instance
