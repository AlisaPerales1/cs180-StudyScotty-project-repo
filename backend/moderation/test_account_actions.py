from base64 import b64encode
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db.models.deletion import ProtectedError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from common.testing import DomainTestCase
from .models import AccountModerationAction
from .services import account_state


class AccountActionTests(TestCase):
    def setUp(self):
        users = get_user_model().objects
        self.admin = users.create_user(username="developer", password="admin-password", is_staff=True)
        self.user = users.create_user(username="student", password="student-password")
        self.other_admin = users.create_user(username="other-admin", is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.expiry = timezone.now() + timedelta(days=1)

    def action(self, action, data=None, user=None):
        target = user or self.user
        return self.client.post(
            f"/api/v1/moderation/users/{target.pk}/{action}/", data or {}, format="json",
        )

    def suspend(self):
        return self.action("suspend", {"reason": "Repeated abuse", "ends_at": self.expiry.isoformat()})

    def test_suspend_ban_and_restore_preserve_history_and_user(self):
        response = self.suspend()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user_id"], self.user.pk)
        self.assertEqual(response.data["state"], "suspended")
        self.assertEqual(response.data["ends_at"], self.expiry)
        self.assertEqual(self.action("ban", {"reason": " Continued abuse "}).status_code, 200)
        self.assertEqual(account_state(self.user), ("banned", None))
        self.assertEqual(self.action("restore", {"reason": "Appeal accepted"}).status_code, 200)
        self.assertEqual(account_state(self.user), ("active", None))
        history = list(self.user.account_moderation_actions.order_by("id"))
        self.assertEqual([entry.action for entry in history], ["suspend", "ban", "restore"])
        self.assertEqual(history[1].reason, "Continued abuse")
        self.assertTrue(all(entry.performed_by == self.admin for entry in history))
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)
        self.assertTrue(self.user.check_password("student-password"))
        with self.assertRaises(ProtectedError):
            self.user.delete()
        with self.assertRaises(ProtectedError):
            self.admin.delete()

    def test_authorization_is_required_for_every_action(self):
        for actor in [None, self.user]:
            self.client.force_authenticate(actor)
            for action in ["suspend", "ban", "restore"]:
                with self.subTest(actor=actor, action=action):
                    self.assertEqual(self.action(action).status_code, 403)
        self.assertFalse(AccountModerationAction.objects.exists())

    def test_inactive_or_restricted_admin_is_denied_even_with_stale_credentials(self):
        get_user_model().objects.filter(pk=self.admin.pk).update(is_active=False)
        self.assertEqual(self.action("ban", {"reason": "Test"}).status_code, 403)
        get_user_model().objects.filter(pk=self.admin.pk).update(is_active=True)
        AccountModerationAction.objects.create(
            user=self.admin, performed_by=self.other_admin, action="ban", reason="Test",
        )
        self.assertEqual(self.action("restore").status_code, 403)

    def test_cannot_moderate_self_staff_or_superuser(self):
        superuser = get_user_model().objects.create_user(username="root", is_superuser=True)
        for target in [self.admin, self.other_admin, superuser]:
            for action in ["suspend", "ban", "restore"]:
                with self.subTest(target=target, action=action):
                    self.assertEqual(self.action(action, {
                        "reason": "Test", **({"ends_at": self.expiry.isoformat()} if action == "suspend" else {}),
                    }, target).status_code, 403)
        self.assertFalse(AccountModerationAction.objects.exists())

    def test_validation_does_not_write_history(self):
        for action, payload in [
            ("suspend", {"reason": "Test"}),
            ("suspend", {"reason": "Test", "ends_at": None}),
            ("suspend", {"reason": "Test", "ends_at": "invalid"}),
            ("suspend", {"reason": "Test", "ends_at": (timezone.now() - timedelta(seconds=1)).isoformat()}),
            ("suspend", {"ends_at": self.expiry.isoformat()}),
            ("ban", {}), ("ban", {"reason": "   "}), ("ban", {"reason": 123}),
            ("ban", {"reason": None}),
            ("ban", {"reason": "Test", "ends_at": self.expiry.isoformat()}),
            ("restore", {"performed_by": self.other_admin.pk}),
            ("restore", {"is_staff": True}), ("restore", {"reason": False}),
        ]:
            with self.subTest(action=action, payload=payload):
                self.assertEqual(self.action(action, payload).status_code, 400)
        self.assertFalse(AccountModerationAction.objects.exists())

    def test_repeated_actions_are_noops_and_suspension_can_be_changed(self):
        self.assertEqual(self.action("restore").status_code, 200)
        self.assertEqual(AccountModerationAction.objects.count(), 0)
        self.suspend()
        self.suspend()
        self.assertEqual(AccountModerationAction.objects.count(), 1)
        self.expiry += timedelta(days=1)
        self.suspend()
        self.assertEqual(AccountModerationAction.objects.count(), 2)
        self.action("ban", {"reason": "Test"})
        self.action("ban", {"reason": "Test again"})
        self.assertEqual(AccountModerationAction.objects.count(), 3)
        self.assertEqual(self.suspend().status_code, 409)
        self.assertEqual(account_state(self.user)[0], "banned")
        self.action("restore")
        self.action("restore")
        self.assertEqual(AccountModerationAction.objects.count(), 4)
        self.assertEqual(self.suspend().status_code, 200)

    def test_expiration_boundary_does_not_require_database_changes(self):
        self.suspend()
        with patch("moderation.services.timezone.now", return_value=self.expiry):
            self.assertEqual(account_state(self.user), ("active", None))
            self.assertEqual(self.action("restore").status_code, 200)
        self.assertEqual(AccountModerationAction.objects.count(), 1)
        self.assertEqual(self.user.account_moderation_actions.get().action, "suspend")

    def test_restore_does_not_enable_manually_disabled_user(self):
        self.action("ban", {"reason": "Test"})
        get_user_model().objects.filter(pk=self.user.pk).update(is_active=False)
        self.assertEqual(self.action("restore").status_code, 200)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get("/api/v1/accounts/me/").status_code, 403)

    def test_missing_user_and_unsupported_requests(self):
        url = f"/api/v1/moderation/users/{self.user.pk}/restore/"
        self.assertEqual(self.client.post("/api/v1/moderation/users/999999/restore/", {}, format="json").status_code, 404)
        for method in ["get", "put", "patch", "delete"]:
            self.assertEqual(getattr(self.client, method)(url).status_code, 405)
        self.assertEqual(self.client.post(url, [], format="json").status_code, 400)
        self.assertEqual(self.client.post(url, "{", content_type="application/json").status_code, 400)
        self.assertEqual(self.client.post(url, "reason=test", content_type="text/plain").status_code, 415)

    def test_failed_write_keeps_previous_state(self):
        self.suspend()
        with patch.object(AccountModerationAction.objects, "create", side_effect=RuntimeError("Storage failed")):
            with self.assertRaises(RuntimeError):
                self.action("ban", {"reason": "Test"})
        self.assertEqual(account_state(self.user), ("suspended", self.expiry))
        self.assertEqual(AccountModerationAction.objects.count(), 1)

    def test_real_basic_and_existing_session_requests_are_blocked_then_restored(self):
        basic = APIClient()
        credentials = b64encode(b"student:student-password").decode()
        basic.credentials(HTTP_AUTHORIZATION=f"Basic {credentials}")
        session = APIClient()
        self.assertTrue(session.login(username="student", password="student-password"))
        profile = "/api/v1/accounts/me/"
        for client in [basic, session]:
            self.assertEqual(client.get(profile).status_code, 200)
        self.suspend()
        for client in [basic, session]:
            self.assertEqual(client.get(profile).status_code, 403)
            self.assertEqual(client.patch(profile, {"first_name": "Blocked"}, format="json").status_code, 403)
            self.assertEqual(client.get("/api/v1/health/").status_code, 200)
        with patch("moderation.services.timezone.now", return_value=self.expiry):
            for client in [basic, session]:
                self.assertEqual(client.get(profile).status_code, 200)
        self.action("ban", {"reason": "Test"})
        for client in [basic, session]:
            self.assertEqual(client.get(profile).status_code, 403)
        self.action("restore")
        for client in [basic, session]:
            self.assertEqual(client.get(profile).status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "")

    def test_admin_basic_auth_works_and_session_writes_require_csrf(self):
        self.client.force_authenticate(None)
        credentials = b64encode(b"developer:admin-password").decode()
        self.client.credentials(HTTP_AUTHORIZATION=f"Basic {credentials}")
        self.assertEqual(self.action("ban", {"reason": "Test"}).status_code, 200)
        session = APIClient(enforce_csrf_checks=True)
        self.assertTrue(session.login(username="developer", password="admin-password"))
        self.assertEqual(session.post(
            f"/api/v1/moderation/users/{self.user.pk}/restore/", {}, format="json",
        ).status_code, 403)
        self.assertEqual(account_state(self.user)[0], "banned")


class AccountActionIntegrityTests(DomainTestCase):
    def test_action_expiry_and_reason_are_constrained(self):
        action = AccountModerationAction.objects.create(
            user=self.member, performed_by=self.user, action="suspend", reason="Test",
            created_at=self.start, ends_at=self.start + timedelta(days=1),
        )
        for changes in [
            {"action": "invalid"}, {"ends_at": None}, {"ends_at": self.start},
            {"reason": ""}, {"action": "ban"}, {"action": "restore"},
        ]:
            with self.subTest(changes=changes):
                self.assert_database_rejects(
                    lambda: AccountModerationAction.objects.filter(pk=action.pk).update(**changes),
                )
        AccountModerationAction.objects.filter(pk=action.pk).update(action="restore", ends_at=None, reason="")
