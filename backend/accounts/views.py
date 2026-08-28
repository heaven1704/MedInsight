from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .serializers import LoginSerializer, UserProfileSerializer


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
