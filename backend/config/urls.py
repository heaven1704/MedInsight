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

    # Step 4: Patient & Family endpoints
    path("api/", include("patients.urls")),

    # Step 6: Appointments
    path("api/", include("appointments.urls")),

    # TODO Step 7: documents
    #   path("api/", include("documents.urls")),
]
