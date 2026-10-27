# Add feature routes after agreeing on the API contract.
from django.urls import path
from .views import RegisterView

urlpatterns = [
    path("signup/", RegisterView.as_view(), name="signup"),
]