"""Exercise signup/login through HTTP and the actual JWT authenticator."""
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import override_settings
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import GoogleIdentity, UserProfile
from accounts.serializers import RegisterSerializer
from moderation.models import AccountModerationAction

User = get_user_model()


class AuthenticationTests(APITestCase):
    password = "Study#Safe8392!"

    def setUp(self):
        self.user = User.objects.create_user(
            username="student", email="student@ucr.edu", password=self.password,
        )
        self.admin = User.objects.create_user(username="moderator", email="moderator@ucr.edu", is_staff=True)

    def login(self, **changes):
        return self.client.post("/api/v1/accounts/login/", {
            "email": " STUDENT@ucr.edu ", "password": self.password, **changes,
        }, format="json")

    def restrict(self, action="ban", **changes):
        return AccountModerationAction.objects.create(
            user=self.user, performed_by=self.admin, action=action, reason="Test", **changes,
        )

    def test_signup_normalizes_email_hashes_password_and_does_not_claim_verification(self):
        response = self.client.post("/api/v1/accounts/signup/", {
            "username": "new_student", "email": " NEW@UCR.EDU ", "password": self.password,
        }, format="json")
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(pk=response.data["user"]["id"])
        self.assertEqual(user.email, "new@ucr.edu")
        self.assertTrue(user.check_password(self.password))
        self.assertNotIn("password", response.data["user"])
        self.assertFalse(UserProfile.objects.filter(user=user).exists())

    def test_signup_rejects_domain_weak_password_and_duplicates(self):
        for changes in [
            {"email": "outside@example.com"}, {"password": "short"},
            {"email": "STUDENT@UCR.EDU"}, {"username": "student"},
        ]:
            with self.subTest(changes=changes):
                response = self.client.post("/api/v1/accounts/signup/", {
                    "username": "new_student", "email": "new@ucr.edu", "password": self.password, **changes,
                }, format="json")
                self.assertEqual(response.status_code, 400)
        self.assertEqual(User.objects.count(), 2)

    def test_password_whitespace_is_preserved(self):
        password = f" {self.password} "
        response = self.client.post("/api/v1/accounts/signup/", {
            "username": "spaced", "email": "spaced@ucr.edu", "password": password,
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.login(email="spaced@ucr.edu", password=password).status_code, 200)
        self.assertEqual(self.login(email="spaced@ucr.edu").status_code, 400)

    def test_login_jwt_reads_and_updates_only_callers_profile(self):
        response = self.login()
        self.assertEqual(response.status_code, 200)
        self.assertIn("refresh", response.data)
        self.assertEqual(AccessToken(response.data["access"])["user_id"], str(self.user.pk))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        self.assertEqual(self.client.get("/api/v1/accounts/me/").data["email"], self.user.email)
        response = self.client.patch("/api/v1/accounts/me/", {"study_preferences": "Quiet spaces"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.user.profile.study_preferences, "Quiet spaces")

    def test_bad_password_unknown_email_and_disabled_account_issue_no_tokens(self):
        for changes in [{"password": "wrong"}, {"email": "unknown@ucr.edu"}]:
            response = self.login(**changes)
            self.assertEqual(response.status_code, 400)
            self.assertNotIn("access", response.data)
        self.user.is_active = False
        self.user.save()
        self.assertEqual(self.login().status_code, 400)

    def test_public_login_and_signup_ignore_stale_bearer_tokens(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer expired-or-invalid")
        self.assertEqual(self.login().status_code, 200)
        self.assertEqual(self.client.post("/api/v1/accounts/signup/", {
            "username": "new", "email": "new@ucr.edu", "password": self.password,
        }, format="json").status_code, 201)

    def test_restrictions_block_token_issuance_and_existing_jwt_access(self):
        access = self.login().data["access"]
        for action, changes in [
            ("ban", {}), ("suspend", {"ends_at": timezone.now() + timedelta(hours=1)}),
        ]:
            with self.subTest(action=action):
                self.restrict(action, **changes)
                self.assertEqual(self.login().status_code, 403)
                self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
                self.assertEqual(self.client.get("/api/v1/accounts/me/").status_code, 403)
                self.assertEqual(self.client.post("/api/v1/accounts/google/link/", {}, format="json").status_code, 403)
                self.client.credentials()
        self.restrict("restore")
        self.assertEqual(self.login().status_code, 200)

    def test_expired_jwt_is_rejected_with_bearer_challenge(self):
        token = AccessToken.for_user(self.user)
        token.set_exp(lifetime=timedelta(seconds=-1))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get("/api/v1/accounts/me/")
        self.assertEqual(response.status_code, 401)
        self.assertTrue(response["WWW-Authenticate"].startswith("Bearer"))

    def test_email_uniqueness_is_enforced_even_after_both_signups_validate(self):
        first = RegisterSerializer(data={"username": "first", "email": "same@ucr.edu", "password": self.password})
        second = RegisterSerializer(data={"username": "second", "email": "SAME@ucr.edu", "password": self.password})
        self.assertTrue(first.is_valid(), first.errors)
        self.assertTrue(second.is_valid(), second.errors)
        first.save()
        with self.assertRaises(ValidationError) as error:
            second.save()
        self.assertIn("email", error.exception.detail)
        self.assertEqual(User.objects.filter(email__iexact="same@ucr.edu").count(), 1)
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.create_user(username="third", email="SAME@ucr.edu")

    @override_settings(GOOGLE_WEB_CLIENT_ID="test-client")
    @patch("accounts.views.id_token.verify_oauth2_token")
    def test_google_login_retains_verified_identity_checks_and_moderation(self, verify):
        GoogleIdentity.objects.create(user=self.user, google_sub="google-student")
        claims = {"sub": "google-student", "email": self.user.email, "email_verified": True}
        verify.return_value = claims
        response = self.client.post("/api/v1/accounts/google/", {"id_token": "test"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.restrict()
        self.assertEqual(self.client.post("/api/v1/accounts/google/", {"id_token": "test"}, format="json").status_code, 403)
        verify.return_value = {**claims, "email_verified": False}
        self.assertEqual(self.client.post("/api/v1/accounts/google/", {"id_token": "test"}, format="json").status_code, 403)
