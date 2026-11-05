

# ===================== spots/models.py  (add these 2 fields to Spot) =====================
    location_details = models.CharField(max_length=300, blank=True)
    photo = models.ImageField(upload_to="spot_photos/", null=True, blank=True)


# ===================== spots/serializers.py  (add the 2 fields to the list) ==============
class SpotSerializer(serializers.ModelSerializer):
    class Meta:
        model = Spot
        fields = [
            "id", "name", "description", "location_details", "photo",
            "latitude", "longitude",
            "noise_level", "has_outlets", "has_wifi", "is_indoor", "group_friendly",
        ]


# ===================== spots/views.py  (replace SpotListView, rest stays the same) =======
from rest_framework import generics
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticatedOrReadOnly


class SpotListView(generics.ListCreateAPIView):
    """
    GET  /api/spots/   list (with the week 4 filters), public
    POST /api/spots/   create a spot, login required. Send multipart form data
                       (name, description, location_details, latitude, longitude,
                        noise_level, has_outlets, has_wifi, is_indoor, group_friendly, photo)
    """
    serializer_class = SpotSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None

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


# ===================== settings.py  (add at the bottom) ==================================
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"


# ===================== project urls.py  (so photos can be viewed while developing) =======
# from django.conf import settings
# from django.conf.urls.static import static
# urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)