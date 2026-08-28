from django.contrib.auth import authenticate
from rest_framework import serializers

from .models import User


class LoginSerializer(serializers.Serializer):
    """Validates credentials and returns the authenticated User instance."""

    username = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, attrs):
        username = attrs.get("username")
        password = attrs.get("password")

        user = authenticate(
            request=self.context.get("request"),
            username=username,
            password=password,
        )

        if not user:
            raise serializers.ValidationError(
                "Invalid credentials. Please try again.",
                code="authorization",
            )

        if not user.is_active:
            raise serializers.ValidationError(
                "This account has been deactivated.",
                code="authorization",
            )

        attrs["user"] = user
        return attrs


class UserProfileSerializer(serializers.ModelSerializer):
    """Read-only profile returned from /api/auth/me/ and embedded in login response."""

    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "email", "full_name", "role")
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username
