from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .models import User
from .permissions import IsAdmin
from .serializers import (
    DoctorDirectorySerializer, LoginSerializer, PendingSignupSerializer,
    SignupSerializer, UserProfileSerializer,
)


class LoginView(APIView):
    """
    POST /api/auth/login/

    Body:  { "username": "...", "password": "..." }

    Returns:
        {
            "access":  "<JWT access token>",
            "refresh": "<JWT refresh token>",
            "user": {
                "id": 1,
                "username": "...",
                "email": "...",
                "full_name": "...",
                "role": "doctor"
            }
        }
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserProfileSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class SignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {"detail": "Signup submitted. Your account is awaiting admin approval.", "user": PendingSignupSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


class PendingSignupListView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        users = User.objects.filter(approval_status=User.ApprovalStatus.PENDING).order_by("date_joined")
        return Response(PendingSignupSerializer(users, many=True).data)


class PendingSignupActionView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk, action):
        try:
            user = User.objects.get(pk=pk, approval_status=User.ApprovalStatus.PENDING)
        except User.DoesNotExist:
            return Response({"detail": "Pending signup not found."}, status=status.HTTP_404_NOT_FOUND)
        if action == "approve":
            user.approval_status = User.ApprovalStatus.APPROVED
            user.is_active = True
            user.save(update_fields=["approval_status", "is_active"])
            return Response(PendingSignupSerializer(user).data)
        user.approval_status = User.ApprovalStatus.REJECTED
        user.is_active = False
        user.save(update_fields=["approval_status", "is_active"])
        return Response(PendingSignupSerializer(user).data)


class DoctorDirectoryView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        doctors = User.objects.filter(
            role=User.Role.DOCTOR,
            approval_status=User.ApprovalStatus.APPROVED,
            is_active=True,
        ).order_by("first_name", "last_name", "username")
        return Response(DoctorDirectorySerializer(doctors, many=True).data)


class LogoutView(APIView):
    """
    POST /api/auth/logout/

    Body:  { "refresh": "<refresh token>" }

    Blacklists the supplied refresh token so it can no longer be used
    to obtain new access tokens.  The client should also discard both
    tokens locally.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return Response(
                {"detail": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError as exc:
            raise InvalidToken({"detail": str(exc)})

        return Response(
            {"detail": "Successfully logged out."},
            status=status.HTTP_205_RESET_CONTENT,
        )


class MeView(APIView):
    """
    GET /api/auth/me/

    Returns the profile of the currently authenticated user
    derived from the Bearer access token.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class RefreshView(TokenRefreshView):
    """
    POST /api/auth/refresh/

    Standard SimpleJWT token refresh — wraps the library view so the URL
    lives under our /api/auth/ namespace without any extra logic.

    Body:    { "refresh": "<refresh token>" }
    Returns: { "access": "<new access token>" }
             (also returns a new "refresh" if ROTATE_REFRESH_TOKENS=True)
    """
    pass
