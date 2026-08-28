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
"""

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),

    # Step 3: JWT auth endpoints
    path("api/auth/", include("accounts.urls", namespace="accounts")),

    # TODO Step 4: add app-level API routes
    #   path("api/patients/",      include("patients.urls")),
    #   path("api/appointments/",  include("appointments.urls")),
    #   path("api/documents/",     include("documents.urls")),
]
