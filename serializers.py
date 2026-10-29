from rest_framework import serializers
from .models import Spot


class SpotSerializer(serializers.ModelSerializer):
    class Meta:
        model = Spot
        fields = [
            "id", "name", "description", "latitude", "longitude",
            "noise_level", "has_outlets", "has_wifi", "is_indoor", "group_friendly",
        ]