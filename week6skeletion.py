# Week 6 skeleton (Alisa): duplicate-spot warning and opening hours (backend)
# Goes in spots/views.py, spots/models.py, spots/serializers.py

import math

from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Spot


# ---- 1. Distance between two coordinates, in meters ----
def distance_meters(lat1, lng1, lat2, lng2):
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = p2 - p1
    dlng = math.radians(lng2 - lng1)
    h = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


# ---- 2. Duplicate warning: GET /api/spots/nearby/?lat=..&lng=..&radius=30 ----
@api_view(["GET"])
def nearby_spots(request):
    # TODO: read lat, lng, radius (default 30) from request.query_params
    # TODO: loop over Spot.objects.all() and keep spots within radius using distance_meters
    # TODO: return Response([...names and distances...])
    return Response([])


# ---- 3. Opening hours (optional) ----
# TODO models.py: add to Spot
#     opens_at = models.TimeField(null=True, blank=True)
#     closes_at = models.TimeField(null=True, blank=True)
# TODO: makemigrations + migrate
# TODO serializers.py: add "opens_at", "closes_at" to fields

# TODO urls: path("spots/nearby/", nearby_spots)  (put it BEFORE spots/<int:pk>/)