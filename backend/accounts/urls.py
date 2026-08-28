from django.urls import path

from .views import (
    LoginView, LogoutView, MeView, PendingSignupActionView,
    DoctorDirectoryView, PendingSignupListView, RefreshView, SignupView,
)

app_name = "accounts"

urlpatterns = [
    path("login/",   LoginView.as_view(),  name="login"),
    path("refresh/", RefreshView.as_view(), name="token-refresh"),
    path("logout/",  LogoutView.as_view(), name="logout"),
    path("me/",      MeView.as_view(),     name="me"),
    path("signup/", SignupView.as_view(), name="signup"),
    path("pending-signups/", PendingSignupListView.as_view(), name="pending-signups"),
    path("pending-signups/<int:pk>/<str:action>/", PendingSignupActionView.as_view(), name="pending-signup-action"),
    path("doctors/", DoctorDirectoryView.as_view(), name="doctor-directory"),
]
