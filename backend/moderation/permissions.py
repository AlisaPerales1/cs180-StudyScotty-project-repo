from django.contrib.auth import get_user_model
from rest_framework.permissions import IsAuthenticated

from .services import account_state


class IsUnrestrictedUser(IsAuthenticated):
    message = "This account is disabled, suspended, or banned."

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        # Read fresh flags even when credentials/cache supply an older user.
        user = get_user_model().objects.filter(pk=request.user.pk).first()
        return bool(user and user.is_active and account_state(user)[0] == "active")


class IsAccountAdmin(IsUnrestrictedUser):
    message = "An active admin account is required."

    def has_permission(self, request, view):
        return super().has_permission(request, view) and get_user_model().objects.filter(
            pk=request.user.pk, is_staff=True,
        ).exists()
