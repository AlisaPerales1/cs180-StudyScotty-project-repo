from django.db import models


class Spot(models.Model):
    NOISE_CHOICES = [
        ("quiet", "Quiet"),
        ("moderate", "Moderate"),
        ("loud", "Loud"),
    ]

    name = models.CharField(max_length=120, unique=True)
    description = models.CharField(max_length=300, blank=True)
    latitude = models.FloatField()
    longitude = models.FloatField()

    # Filter fields (used in week 4, cheap to add now)
    noise_level = models.CharField(max_length=10, choices=NOISE_CHOICES, default="moderate")
    has_outlets = models.BooleanField(default=True)
    has_wifi = models.BooleanField(default=True)
    is_indoor = models.BooleanField(default=True)
    group_friendly = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
