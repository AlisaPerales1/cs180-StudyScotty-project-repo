from django.contrib.auth import get_user_model
from django.test import TestCase

from common.testing import DomainTestCase
from .models import Course, UserCourse, UserProfile


class UserTests(TestCase):
    def test_custom_user_hashes_password(self):
        user = get_user_model().objects.create_user(
            username="scotty", email="scotty@ucr.edu", password="test-password-482!",
        )
        self.assertTrue(user.check_password("test-password-482!"))
        self.assertNotEqual(user.password, "test-password-482!")


class AccountRelationshipTests(DomainTestCase):
    def test_profile_is_one_to_one_and_deleted_with_user(self):
        profile = UserProfile.objects.create(user=self.member)
        self.assertEqual(profile.pk, self.member.pk)
        self.assert_database_rejects(lambda: UserProfile.objects.create(user=self.member))
        UserCourse.objects.create(user=self.member, course=self.course)
        self.member.delete()
        self.assertFalse(UserProfile.objects.exists())
        self.assertFalse(UserCourse.objects.exists())

    def test_course_membership_and_course_code_are_unique(self):
        UserCourse.objects.create(user=self.member, course=self.course)
        self.assert_database_rejects(lambda: UserCourse.objects.create(user=self.member, course=self.course))
        self.assert_database_rejects(lambda: Course.objects.create(code=self.course.code, name="Duplicate"))


class ProfileEndpointTests(TestCase):
    url = "/api/v1/accounts/me/"

    def setUp(self):
        from rest_framework.test import APIClient

        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="scotty", email="scotty@ucr.edu", password="test-password-482!",
            first_name="Scotty", last_name="Highlander",
        )
        self.other = get_user_model().objects.create_user(username="other", email="other@ucr.edu")
        self.client.force_authenticate(self.user)

    def test_get_returns_current_user_without_creating_missing_profile(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "username": "scotty", "email": "scotty@ucr.edu",
            "first_name": "Scotty", "last_name": "Highlander", "study_preferences": "",
        })
        self.assertFalse(UserProfile.objects.filter(user=self.user).exists())

    def test_existing_preferences_are_returned(self):
        UserProfile.objects.create(user=self.user, study_preferences="Quiet spaces")
        self.assertEqual(self.client.get(self.url).json()["study_preferences"], "Quiet spaces")

    def test_partial_update_persists_both_tables_and_only_current_user(self):
        response = self.client.patch(self.url, {
            "username": "new_scotty", "first_name": " New ", "study_preferences": " Quiet ",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["username"], "new_scotty")
        self.assertEqual(response.json()["first_name"], "New")
        self.assertEqual(response.json()["study_preferences"], "Quiet")
        self.user.refresh_from_db()
        self.other.refresh_from_db()
        self.assertEqual(self.user.username, "new_scotty")
        self.assertEqual(self.user.last_name, "Highlander")
        self.assertEqual(self.user.profile.study_preferences, "Quiet")
        self.assertEqual(self.other.username, "other")
        self.assertTrue(self.user.check_password("test-password-482!"))
        self.assertEqual(self.client.get(self.url).json(), response.json())

    def test_updates_existing_profile_and_can_clear_optional_fields(self):
        UserProfile.objects.create(user=self.user, study_preferences="Old")
        response = self.client.patch(self.url, {
            "first_name": "", "last_name": "", "study_preferences": "",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(UserProfile.objects.filter(user=self.user).count(), 1)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "")
        self.assertEqual(self.user.last_name, "")
        self.assertEqual(self.user.profile.study_preferences, "")

    def test_invalid_username_or_name_does_not_partially_save(self):
        for changes, field in [
            ({"username": "other"}, "username"),
            ({"username": "bad name!"}, "username"),
            ({"username": ""}, "username"),
            ({"username": "x" * 151}, "username"),
            ({"first_name": "x" * 151}, "first_name"),
            ({"last_name": "x" * 151}, "last_name"),
            ({"first_name": None}, "first_name"),
            ({"study_preferences": None}, "study_preferences"),
            ({"first_name": 123}, "first_name"),
        ]:
            with self.subTest(field=field, changes=changes):
                response = self.client.patch(self.url, {"study_preferences": "Changed", **changes}, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.json())
                self.assertFalse(UserProfile.objects.filter(user=self.user).exists())
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "scotty")

    def test_unknown_and_protected_fields_are_rejected(self):
        for field, value in [
            ("email", "new@ucr.edu"), ("id", self.other.pk), ("user", self.other.pk),
            ("is_staff", True), ("password", "new-password"),
            ("email_verified_at", "2026-10-30T00:00:00Z"), ("description", "Bio"),
        ]:
            with self.subTest(field=field):
                response = self.client.patch(self.url, {field: value, "first_name": "Changed"}, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.json())
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Scotty")
        self.assertEqual(self.user.email, "scotty@ucr.edu")
        self.assertFalse(self.user.is_staff)

    def test_empty_patch_and_unchanged_username_are_valid(self):
        self.assertEqual(self.client.patch(self.url, {}, format="json").status_code, 200)
        self.assertEqual(self.client.patch(self.url, {"username": "scotty"}, format="json").status_code, 200)
        self.assertFalse(UserProfile.objects.filter(user=self.user).exists())

    def test_anonymous_requests_are_rejected(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.assertEqual(self.client.patch(self.url, {"first_name": "Changed"}, format="json").status_code, 403)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Scotty")

    def test_unsupported_methods_and_malformed_input(self):
        for method in ("post", "put", "delete"):
            self.assertEqual(getattr(self.client, method)(self.url, {}, format="json").status_code, 405)
        self.assertEqual(self.client.patch(self.url, [], format="json").status_code, 400)
        self.assertEqual(self.client.patch(self.url, '{', content_type="application/json").status_code, 400)

    def test_transaction_rolls_back_user_update_if_profile_save_fails(self):
        from unittest.mock import patch

        with patch.object(UserProfile, "save", side_effect=RuntimeError("storage failed")):
            with self.assertRaises(RuntimeError):
                self.client.patch(self.url, {"first_name": "Changed", "study_preferences": "New"}, format="json")
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Scotty")
        self.assertFalse(UserProfile.objects.filter(user=self.user).exists())

    def test_basic_auth_uses_changed_username_with_existing_password(self):
        from base64 import b64encode

        self.client.force_authenticate(user=None)
        credentials = b64encode(b"scotty:test-password-482!").decode()
        self.client.credentials(HTTP_AUTHORIZATION=f"Basic {credentials}")
        response = self.client.patch(self.url, {"username": "renamed"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        credentials = b64encode(b"renamed:test-password-482!").decode()
        self.client.credentials(HTTP_AUTHORIZATION=f"Basic {credentials}")
        self.assertEqual(self.client.get(self.url).json()["username"], "renamed")

    def test_session_authenticated_patch_requires_csrf(self):
        from rest_framework.test import APIClient

        client = APIClient(enforce_csrf_checks=True)
        self.assertTrue(client.login(username="scotty", password="test-password-482!"))
        self.assertEqual(client.get(self.url).status_code, 200)
        self.assertEqual(client.patch(self.url, {"first_name": "Changed"}, format="json").status_code, 403)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Scotty")

    def test_bio_uses_study_preferences_and_preserves_other_profile_data(self):
        from django.utils import timezone

        verified_at = timezone.now()
        UserProfile.objects.create(
            user=self.user, study_preferences="Old bio", profile_photo_key="photos/one.jpg",
            email_verified_at=verified_at,
        )
        bio = "CS student at UCR.\nI prefer quiet spaces and small study groups. 📚"
        response = self.client.patch(self.url, {"study_preferences": f"  {bio}  "}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "username": "scotty", "email": "scotty@ucr.edu",
            "first_name": "Scotty", "last_name": "Highlander", "study_preferences": bio,
        })
        profile = UserProfile.objects.get(user=self.user)
        self.assertEqual(profile.study_preferences, bio)
        self.assertEqual(profile.profile_photo_key, "photos/one.jpg")
        self.assertEqual(profile.email_verified_at, verified_at)
        self.assertEqual(self.client.get(self.url).json(), response.json())
        self.assertFalse(UserProfile.objects.filter(user=self.other).exists())

    def test_bio_can_be_cleared_and_omitted_without_changes(self):
        UserProfile.objects.create(user=self.user, study_preferences="Existing bio")
        response = self.client.patch(self.url, {"first_name": "New name"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["study_preferences"], "Existing bio")
        response = self.client.patch(self.url, {"study_preferences": "   "}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["study_preferences"], "")
        self.assertEqual(UserProfile.objects.get(user=self.user).study_preferences, "")
        self.assertEqual(self.client.get(self.url).json()["first_name"], "New name")

    def test_bio_requires_string_and_alias_keys_are_rejected(self):
        for changes, field in [
            ({"study_preferences": None}, "study_preferences"),
            ({"study_preferences": 123}, "study_preferences"),
            ({"study_preferences": True}, "study_preferences"),
            ({"study_preferences": []}, "study_preferences"),
            ({"study_preferences": {}}, "study_preferences"),
            ({"bio": "Text"}, "bio"),
            ({"description": "Text"}, "description"),
        ]:
            with self.subTest(field=field, changes=changes):
                response = self.client.patch(self.url, changes, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.json())
                self.assertFalse(UserProfile.objects.filter(user=self.user).exists())
