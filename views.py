# spots/views.py  (Week 4: filters + detail + urls in one file)
#
# Project urls.py needs ONE line:
#     path("api/", include("spots.views")),
#
# Endpoints:
#   GET /api/spots/                        -> list, with optional filters:
#       ?noise=quiet|moderate|loud  &outlets=true  &wifi=true
#       &indoor=true|false          &group_friendly=true
#   GET /api/spots/<id>/                   -> one spot

from django.urls import path
from rest_framework import generics
from rest_framework.permissions import AllowAny

from .models import Spot
from .serializers import SpotSerializer


def parse_bool(value):
    return str(value).lower() in ("1", "true", "yes")


class SpotListView(generics.ListAPIView):
    serializer_class = SpotSerializer
    permission_classes = [AllowAny]  # public read-only so the map isn't blocked by auth
    pagination_class = None          # plain array

    def get_queryset(self):
        qs = Spot.objects.all().order_by("name")
        p = self.request.query_params

        if p.get("noise"):
            qs = qs.filter(noise_level=p["noise"])
        if p.get("outlets"):
            qs = qs.filter(has_outlets=parse_bool(p["outlets"]))
        if p.get("wifi"):
            qs = qs.filter(has_wifi=parse_bool(p["wifi"]))
        if p.get("indoor"):
            qs = qs.filter(is_indoor=parse_bool(p["indoor"]))
        if p.get("group_friendly"):
            qs = qs.filter(group_friendly=parse_bool(p["group_friendly"]))
        return qs


class SpotDetailView(generics.RetrieveAPIView):
    queryset = Spot.objects.all()
    serializer_class = SpotSerializer
    permission_classes = [AllowAny]


urlpatterns = [
    path("spots/", SpotListView.as_view(), name="spot-list"),
    path("spots/<int:pk>/", SpotDetailView.as_view(), name="spot-detail"),
]g