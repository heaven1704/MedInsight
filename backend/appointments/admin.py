from django.contrib import admin
from .models import Appointment


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display   = ("patient", "doctor", "date", "time", "status")
    list_filter    = ("status", "date")
    search_fields  = (
        "patient__full_name",
        "doctor__username",
        "doctor__first_name",
        "doctor__last_name",
    )
    date_hierarchy = "date"
    fieldsets = (
        ("Appointment", {
            "fields": ("patient", "doctor", "date", "time", "reason", "status")
        }),
    )
