from rest_framework import generics
from rest_framework.permissions import AllowAny

from .models import Spot
from .serializers import SpotSerializer


class SpotListView(generics.ListAPIView):
    """GET /api/spots/  (public read-only for now so the map isn't blocked by auth)"""
    queryset = Spot.objects.all().order_by("name")
    serializer_class = SpotSerializer
    permission_classes = [AllowAny]
    pagination_class = None  # return a plain array