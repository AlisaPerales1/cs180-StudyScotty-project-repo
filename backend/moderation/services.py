from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from .models import AccountModerationAction


class InvalidTransition(APIException):
    status_code = 409
    default_detail = "Restore a banned account before suspending it."


def account_state(user, *, at=None):
    """Return moderation state, independently of Django's manual is_active flag."""
    latest = AccountModerationAction.objects.filter(user_id=user.pk).first()
    at = at or timezone.now()
    if latest and latest.action == AccountModerationAction.Action.BAN:
        return "banned", None
    if latest and latest.action == AccountModerationAction.Action.SUSPEND and latest.ends_at > at:
        return "suspended", latest.ends_at
    return "active", None


@transaction.atomic
def moderate_account(*, actor, user_id, action, reason="", ends_at=None):
    # Re-read authority and lock the target: all endpoint transitions serialize
    # on this user row on databases supporting SELECT FOR UPDATE (PostgreSQL).
    actor = get_user_model().objects.get(pk=actor.pk)
    if not actor.is_active or not actor.is_staff or account_state(actor)[0] != "active":
        raise PermissionDenied("An active admin account is required.")
    user = get_object_or_404(get_user_model().objects.select_for_update(), pk=user_id)
    if user.pk == actor.pk or user.is_staff or user.is_superuser:
        raise PermissionDenied("You cannot moderate yourself or another admin.")
    now = timezone.now()
    state, current_end = account_state(user, at=now)
    actions = AccountModerationAction.Action
    if action not in actions.values:
        raise ValidationError({"action": ["Invalid action."]})
    if action == actions.SUSPEND:
        if ends_at is None or ends_at <= now:
            raise ValidationError({"ends_at": ["Must be in the future."]})
        if state == "banned":
            raise InvalidTransition()
    elif ends_at is not None:
        raise ValidationError({"ends_at": ["Only suspensions can expire."]})
    reason = reason.strip()
    if action != actions.RESTORE and not reason:
        raise ValidationError({"reason": ["This field may not be blank."]})
    unchanged = (
        (action == actions.BAN and state == "banned")
        or (action == actions.RESTORE and state == "active")
        or (action == actions.SUSPEND and state == "suspended" and current_end == ends_at)
    )
    if not unchanged:
        AccountModerationAction.objects.create(
            user=user, performed_by=actor, action=action, reason=reason,
            ends_at=ends_at, created_at=now,
        )
    state, expiry = account_state(user)
    return {"user_id": user.pk, "state": state, "ends_at": expiry}
