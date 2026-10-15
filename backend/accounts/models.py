from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Project user; profile fields and UCR verification are future work."""
