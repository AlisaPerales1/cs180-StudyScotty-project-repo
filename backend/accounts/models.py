from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Username login is retained until the UCR verification policy is agreed."""

    email = models.EmailField(max_length=254)


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        primary_key=True, related_name="profile",
    )
    profile_photo_key = models.CharField(max_length=500, blank=True)
    study_preferences = models.TextField(blank=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class Course(models.Model):
    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=200)

    def __str__(self):
        return self.code


class UserCourse(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="course_memberships",
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="memberships")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "course"], name="unique_user_course"),
        ]
