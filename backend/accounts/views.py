from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import RegisterSerializer, LoginSerializer
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import GoogleIdentity

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response(
            {
                "message": "Account created successfully.",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        return Response(
            serializer.validated_data,
            status=status.HTTP_200_OK,
        )



class GoogleLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.data.get("id_token")

        if not isinstance(token, str) or not token.strip():
            return Response(
                {"error": "Google ID token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not settings.GOOGLE_WEB_CLIENT_ID:
            return Response(
                {"error": "Google authentication is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            google_user = id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                settings.GOOGLE_WEB_CLIENT_ID,
            )
        except (ValueError, GoogleAuthError):
            return Response(
                {"error": "Invalid Google ID token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        email = (google_user.get("email") or "").strip().lower()
        google_sub = google_user.get("sub")

        if (
            not google_sub
            or google_user.get("email_verified") is not True
            or not email.endswith("@ucr.edu")
        ):
            return Response(
                {"error": "A verified UCR Google account is required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Find an account already linked to this Google identity.
        identity = GoogleIdentity.objects.select_related("user").filter(
            google_sub=google_sub
        ).first()

        if identity:
            user = identity.user

            # Reject disabled accounts.
            if not user.is_active:
                return Response(
                    {"error": "This account is disabled."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            # Ensure the linked account email still matches.
            if user.email.strip().lower() != email:
                return Response(
                    {"error": "Google account email mismatch."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        else:
            # Never automatically link by matching email alone.
            if User.objects.filter(email__iexact=email).exists():
                return Response(
                    {
                        "error": (
                            "An account with this email already exists. "
                            "Sign in with your password and link Google."
                        )
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            # Create a new StudyScotty user and Google identity.
            try:
                with transaction.atomic():
                    user = User(
                        username=f"google_{google_sub}",
                        email=email,
                    )
                    user.set_unusable_password()
                    user.save()

                    GoogleIdentity.objects.create(
                        user=user,
                        google_sub=google_sub,
                    )

            except IntegrityError:
                return Response(
                    {"error": "Account creation conflict. Please retry."},
                    status=status.HTTP_409_CONFLICT,
                )

        # Issue StudyScotty JWT tokens.
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                },
            },
            status=status.HTTP_200_OK,
        )

class GoogleLinkView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # Step 1: Verify the user's StudyScotty password.
        password = request.data.get("password")

        if not isinstance(password, str) or not password:
            return Response(
                {"error": "Your StudyScotty password is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not request.user.has_usable_password():
            return Response(
                {"error": "This account does not have a local password."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not request.user.check_password(password):
            return Response(
                {"error": "Incorrect StudyScotty password."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Step 2: Get the Google ID token.
        token = request.data.get("id_token")

        if not isinstance(token, str) or not token.strip():
            return Response(
                {"error": "Google ID token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not settings.GOOGLE_WEB_CLIENT_ID:
            return Response(
                {"error": "Google authentication is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Step 3: Verify the Google ID token.
        try:
            google_user = id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                settings.GOOGLE_WEB_CLIENT_ID,
            )
        except (ValueError, GoogleAuthError):
            return Response(
                {"error": "Invalid Google ID token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        email = (google_user.get("email") or "").strip().lower()
        google_sub = google_user.get("sub")

        # Step 4: Require a verified UCR Google account.
        if (
            not google_sub
            or google_user.get("email_verified") is not True
            or not email.endswith("@ucr.edu")
        ):
            return Response(
                {"error": "A verified UCR Google account is required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Step 5: Match the Google email to the StudyScotty email.
        if request.user.email.strip().lower() != email:
            return Response(
                {"error": "Google email must match your StudyScotty email."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Step 6: Create the link safely.
        try:
            with transaction.atomic():
                existing = (
                    GoogleIdentity.objects.select_for_update()
                    .filter(user=request.user)
                    .first()
                )

                if existing:
                    if existing.google_sub == google_sub:
                        return Response(
                            {"message": "Google account is already linked."},
                            status=status.HTTP_200_OK,
                        )

                    return Response(
                        {"error": "A different Google account is already linked."},
                        status=status.HTTP_409_CONFLICT,
                    )

                # Prevent linking a Google identity to multiple users.
                if GoogleIdentity.objects.filter(
                    google_sub=google_sub
                ).exists():
                    return Response(
                        {"error": "Google account is linked to another user."},
                        status=status.HTTP_409_CONFLICT,
                    )

                GoogleIdentity.objects.create(
                    user=request.user,
                    google_sub=google_sub,
                )

        except IntegrityError:
            return Response(
                {"error": "Google account linking conflict."},
                status=status.HTTP_409_CONFLICT,
            )

        # Step 7: Return success.
        return Response(
            {
                "message": "Google account linked successfully.",
                "user": {
                    "id": request.user.id,
                    "username": request.user.username,
                    "email": request.user.email,
                },
            },
            status=status.HTTP_200_OK,
        )

