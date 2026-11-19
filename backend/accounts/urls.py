from django.urls import path

from .profile_views import CurrentProfileView
from .views import (
    RegisterView,
    LoginView,
    GoogleLoginView,
    GoogleLinkView,
)

urlpatterns = [
    path("me/", CurrentProfileView.as_view(), name="current-profile"),
    path("signup/", RegisterView.as_view(), name="signup"),
    path("login/", LoginView.as_view(), name="login"),
    path("google/", GoogleLoginView.as_view(), name="google-login"),
    path("google/link/", GoogleLinkView.as_view(), name="google-link"),
]
