from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.tokens import RefreshToken

from moderation.services import account_state


User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )

    class Meta:
        model = User
        fields = ["id", "username", "email", "password"]
        read_only_fields = ["id"]

    def validate_email(self, value):
        email = value.strip().lower()

        if not email.endswith("@ucr.edu"):
            raise serializers.ValidationError(
                "Please use a valid UCR email address."
            )

        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )

        return email

    def validate(self, attrs):
        try:
            validate_password(attrs["password"], user=User(
                username=attrs["username"], email=attrs["email"],
            ))
        except DjangoValidationError as error:
            raise serializers.ValidationError({"password": error.messages})
        return attrs

    def create(self, validated_data):
        try:
            with transaction.atomic():
                return User.objects.create_user(**validated_data)
        except IntegrityError:
            # Validation alone cannot prevent simultaneous signup requests.
            if User.objects.filter(email__iexact=validated_data["email"]).exists():
                raise serializers.ValidationError({"email": ["An account with this email already exists."]})
            if User.objects.filter(username=validated_data["username"]).exists():
                raise serializers.ValidationError({"username": ["A user with that username already exists."]})
            raise


def require_unrestricted_user(user):
    if not user.is_active or account_state(user)[0] != "active":
        raise PermissionDenied("This account is disabled, suspended, or banned.")


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        email = attrs["email"].strip().lower()
        password = attrs["password"]

        user = User.objects.filter(email__iexact=email).first()

        if user is None:
            raise serializers.ValidationError(
                "Invalid email or password."
            )

        authenticated_user = authenticate(
            request=self.context.get("request"),
            username=user.username,
            password=password,
        )

        if authenticated_user is None:
            raise serializers.ValidationError(
                "Invalid email or password."
            )

        require_unrestricted_user(authenticated_user)
        refresh = RefreshToken.for_user(authenticated_user)

        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": authenticated_user.id,
                "username": authenticated_user.username,
                "email": authenticated_user.email,
            },
        }
