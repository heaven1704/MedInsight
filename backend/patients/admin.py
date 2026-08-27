from django.contrib import admin

from .models import Patient


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display   = ("full_name", "date_of_birth", "gender", "phone", "email", "blood_group", "created_at")
    list_filter    = ("gender", "blood_group")
    search_fields  = ("full_name", "phone", "email")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        ("Personal Info", {
            "fields": ("full_name", "date_of_birth", "gender", "phone", "email", "address")
        }),
        ("Medical Info", {
            "fields": ("blood_group", "allergies", "medical_history")
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )
