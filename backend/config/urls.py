"""
MedInsight URL configuration.

Current routes
--------------
/admin/   — Django admin (always present)

Routes added in later steps
---------------------------
Step 3:  /api/auth/     — JWT token obtain/refresh/verify + custom auth endpoints
Step 4:  /api/patients/ — Patient CRUD
Step 4:  /api/appointments/ — Appointment CRUD
Step 4:  /api/documents/    — Document upload / retrieval
Step 8:  POST /api/documents/{id}/run-ocr/ — synchronous OCR via ai-service
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls", namespace="accounts")),
    path("api/", include("patients.urls")),
    path("api/", include("appointments.urls")),
    path("api/", include("documents.urls")),
    path("api/dashboard/", include("dashboard.urls")),
]

# Serve uploaded media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
