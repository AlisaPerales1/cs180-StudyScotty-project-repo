from collections.abc import Mapping

from rest_framework import serializers


class AccountActionSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)

    def to_internal_value(self, data):
        if isinstance(data, Mapping):
            errors = {}
            for key, value in data.items():
                if key not in self.fields:
                    errors[key] = ["Unknown field."]
                elif key == "reason" and not isinstance(value, str):
                    errors[key] = ["Must be a string."]
            if errors:
                raise serializers.ValidationError(errors)
        return super().to_internal_value(data)


class RestrictAccountSerializer(AccountActionSerializer):
    reason = serializers.CharField()


class SuspendAccountSerializer(RestrictAccountSerializer):
    ends_at = serializers.DateTimeField()
