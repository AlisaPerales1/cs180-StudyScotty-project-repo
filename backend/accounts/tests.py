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
