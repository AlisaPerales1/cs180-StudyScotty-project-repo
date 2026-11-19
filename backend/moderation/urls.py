from django.urls import path

from .views import AccountActionView, BanAccountView, SuspendAccountView

urlpatterns = [
    path("users/<int:user_id>/suspend/", SuspendAccountView.as_view(), name="suspend-account"),
    path("users/<int:user_id>/ban/", BanAccountView.as_view(), name="ban-account"),
    path("users/<int:user_id>/restore/", AccountActionView.as_view(), name="restore-account"),
]
