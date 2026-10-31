from django.urls import path

from .profile_views import CurrentProfileView

urlpatterns = [path("me/", CurrentProfileView.as_view(), name="current-profile")]
