from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import FamilyMembersView, PatientViewSet

router = DefaultRouter()
router.register(r"patients",  PatientViewSet,      basename="patient")
router.register(r"families",  FamilyMembersView,   basename="family")

urlpatterns = [
    path("", include(router.urls)),
]
