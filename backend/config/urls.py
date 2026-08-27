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
from django.urls import path

# Media file serving in development is added in Step 4 when the first
# model-backed file upload is wired up.

urlpatterns = [
    path("admin/", admin.site.urls),

    # TODO Step 3: add JWT auth routes
    #   path("api/auth/", include("accounts.urls")),

    # TODO Step 4: add app-level API routes
    #   path("api/patients/",      include("patients.urls")),
    #   path("api/appointments/",  include("appointments.urls")),
    #   path("api/documents/",     include("documents.urls")),
]
