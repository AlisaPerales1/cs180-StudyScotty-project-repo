from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("common.urls")),
    path("api/v1/accounts/", include("accounts.urls")),
    path("api/v1/spots/", include("spots.urls")),
    path("api/v1/study-sessions/", include("study_sessions.urls")),
    path("api/v1/moderation/", include("moderation.urls")),
]
