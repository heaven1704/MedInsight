from rest_framework.routers import DefaultRouter
from django.urls import path, include

from .views import DocumentViewSet

app_name = "documents"

router = DefaultRouter()
router.register(r"documents", DocumentViewSet, basename="document")

urlpatterns = [
    path("", include(router.urls)),
]
