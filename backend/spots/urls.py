from django.urls import path

from .views import (
    FavoriteListView,
    ReviewDetailView,
    SpotBusynessView,
    SpotFavoriteView,
    SpotHoursView,
    SpotReviewListView,
    SpotReviewSummaryView,
)

# Spot list/detail routes ("" and "<int:spot_id>/") are reserved for the spot map feature.
urlpatterns = [
    path("favorites/", FavoriteListView.as_view(), name="favorite-list"),
    path("reviews/<int:review_id>/", ReviewDetailView.as_view(), name="review-detail"),
    path("<int:spot_id>/reviews/", SpotReviewListView.as_view(), name="spot-reviews"),
    path("<int:spot_id>/reviews/summary/", SpotReviewSummaryView.as_view(), name="spot-review-summary"),
    path("<int:spot_id>/favorite/", SpotFavoriteView.as_view(), name="spot-favorite"),
    path("<int:spot_id>/busyness/", SpotBusynessView.as_view(), name="spot-busyness"),
    path("<int:spot_id>/hours/", SpotHoursView.as_view(), name="spot-hours"),
]
