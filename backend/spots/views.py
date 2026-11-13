from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from moderation.permissions import IsUnrestrictedUser
from .models import Favorite, Review, Spot
from .serializers import (
    BusynessCheckInSerializer,
    BusynessReportSerializer,
    FavoriteSerializer,
    ReviewSerializer,
    SpotHoursSerializer,
)
from .services import busyness_summary, create_busyness_report, rating_summary


class SpotScopedMixin:
    """Load the spot from the URL after authentication and permissions pass."""

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.spot = get_object_or_404(Spot, pk=kwargs["spot_id"])


class SpotReviewListView(SpotScopedMixin, generics.ListCreateAPIView):
    """GET a spot's reviews (newest first, paginated) or POST a new review."""

    permission_classes = [IsUnrestrictedUser]
    parser_classes = [JSONParser]
    serializer_class = ReviewSerializer

    def get_queryset(self):
        return Review.objects.filter(spot=self.spot).select_related("author").order_by("-created_at", "-id")

    def perform_create(self, serializer):
        serializer.save(spot=self.spot, author=self.request.user)


class SpotReviewSummaryView(SpotScopedMixin, APIView):
    permission_classes = [IsUnrestrictedUser]
    http_method_names = ["get", "head", "options"]

    def get(self, request, spot_id):
        return Response(rating_summary(self.spot))


class ReviewDetailView(generics.UpdateAPIView, generics.DestroyAPIView):
    """PATCH or DELETE your own review."""

    permission_classes = [IsUnrestrictedUser]
    parser_classes = [JSONParser]
    serializer_class = ReviewSerializer
    http_method_names = ["patch", "delete", "options"]

    def get_object(self):
        review = get_object_or_404(Review.objects.select_related("author"), pk=self.kwargs["review_id"])
        if review.author_id != self.request.user.pk:
            raise PermissionDenied("You can only change your own review.")
        return review


class FavoriteListView(generics.ListAPIView):
    """GET the current user's favorite spots, newest first, paginated."""

    permission_classes = [IsUnrestrictedUser]
    serializer_class = FavoriteSerializer

    def get_queryset(self):
        return Favorite.objects.filter(user=self.request.user).select_related("spot").order_by("-created_at", "-id")


class SpotFavoriteView(SpotScopedMixin, APIView):
    """GET, PUT (create or update), or DELETE the current user's favorite for a spot."""

    permission_classes = [IsUnrestrictedUser]
    parser_classes = [JSONParser]
    http_method_names = ["get", "put", "delete", "head", "options"]

    def get(self, request, spot_id):
        favorite = Favorite.objects.filter(user=request.user, spot=self.spot).select_related("spot").first()
        if favorite is None:
            raise NotFound("This spot is not in your favorites.")
        return Response(FavoriteSerializer(favorite).data)

    def put(self, request, spot_id):
        serializer = FavoriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reminder = serializer.validated_data.get("opening_reminder_enabled")
        with transaction.atomic():
            # get_or_create retries the lookup if a concurrent request wins the unique constraint.
            favorite, created = Favorite.objects.select_for_update().get_or_create(
                user=request.user, spot=self.spot,
                defaults={"opening_reminder_enabled": bool(reminder)},
            )
            if not created and reminder is not None and favorite.opening_reminder_enabled != reminder:
                favorite.opening_reminder_enabled = reminder
                favorite.save(update_fields=["opening_reminder_enabled"])
        return Response(
            FavoriteSerializer(favorite).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, spot_id):
        Favorite.objects.filter(user=request.user, spot=self.spot).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SpotBusynessView(SpotScopedMixin, APIView):
    """GET the current busyness summary or POST a check-in report."""

    permission_classes = [IsUnrestrictedUser]
    parser_classes = [JSONParser]
    http_method_names = ["get", "post", "head", "options"]

    def get(self, request, spot_id):
        return Response(busyness_summary(self.spot))

    def post(self, request, spot_id):
        serializer = BusynessCheckInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = create_busyness_report(spot=self.spot, reporter=request.user, **serializer.validated_data)
        return Response(BusynessReportSerializer(report).data, status=status.HTTP_201_CREATED)


class SpotHoursView(SpotScopedMixin, APIView):
    permission_classes = [IsUnrestrictedUser]
    http_method_names = ["get", "head", "options"]

    def get(self, request, spot_id):
        return Response(SpotHoursSerializer(self.spot).data)
