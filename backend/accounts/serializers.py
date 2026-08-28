from django.contrib.auth import authenticate, get_user_model
from rest_framework import serializers

from .models import User


class LoginSerializer(serializers.Serializer):
    """Validates credentials and returns the authenticated User instance."""

    username = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, attrs):
        username = attrs.get("username")
        password = attrs.get("password")

        user_model = get_user_model()
        existing_user = user_model.objects.filter(username=username).first()
        if existing_user and existing_user.check_password(password) and existing_user.approval_status != user_model.ApprovalStatus.APPROVED:
            raise serializers.ValidationError(
                "Your account is awaiting admin approval",
                code="authorization",
            )

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
        fields = ("id", "username", "email", "full_name", "role", "approval_status")
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class SignupSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    requested_role = serializers.ChoiceField(choices=("doctor", "receptionist"))

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated_data):
        full_name = validated_data.pop("full_name").strip()
        first_name, *last_names = full_name.split()
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=first_name,
            last_name=" ".join(last_names),
            role=validated_data["requested_role"],
            approval_status=User.ApprovalStatus.PENDING,
            is_active=False,
        )


class PendingSignupSerializer(UserProfileSerializer):
    class Meta(UserProfileSerializer.Meta):
        fields = UserProfileSerializer.Meta.fields + ("date_joined",)
        read_only_fields = fields


class DoctorDirectorySerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "email", "full_name", "role")
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username
