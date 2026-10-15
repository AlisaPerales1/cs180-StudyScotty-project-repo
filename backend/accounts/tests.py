from django.contrib.auth import get_user_model
from django.test import TestCase


class UserTests(TestCase):
    def test_custom_user_hashes_password(self):
        user = get_user_model().objects.create_user(
            username="scotty", email="scotty@ucr.edu", password="test-password-482!",
        )
        self.assertTrue(user.check_password("test-password-482!"))
        self.assertNotEqual(user.password, "test-password-482!")
