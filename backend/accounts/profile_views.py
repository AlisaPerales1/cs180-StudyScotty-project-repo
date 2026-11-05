from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .profile_serializers import ProfileSerializer


class CurrentProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = get_user_model().objects.select_related("profile").get(pk=request.user.pk)
        return Response(ProfileSerializer(user).data)

    def patch(self, request):
        user_model = get_user_model()
        try:
            with transaction.atomic():
                user = user_model.objects.select_for_update().get(pk=request.user.pk)
                serializer = ProfileSerializer(user, data=request.data, partial=True)
                serializer.is_valid(raise_exception=True)
                serializer.save()
                data = serializer.data
        except IntegrityError:
            # A competing request can claim a username after uniqueness validation.
            username = serializer.validated_data.get("username")
            if (
                username is not None
                and user_model.objects.filter(username=username).exclude(pk=request.user.pk).exists()
            ):
                raise serializers.ValidationError({
                    "username": ["A user with that username already exists."],
                })
            raise
        return Response(data)
