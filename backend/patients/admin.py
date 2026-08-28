from django.contrib import admin

from .models import Family, Patient


@admin.register(Family)
class FamilyAdmin(admin.ModelAdmin):
    list_display  = ("family_name", "created_at", "member_count")
    search_fields = ("family_name",)
    readonly_fields = ("created_at",)

    def member_count(self, obj):
        return obj.members.count()
    member_count.short_description = "Members"


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display    = ("full_name", "date_of_birth", "gender", "phone", "email", "blood_group", "family", "created_at")
    list_filter     = ("gender", "blood_group", "family")
    search_fields   = ("full_name", "phone", "email")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        ("Personal Info", {
            "fields": ("full_name", "date_of_birth", "gender", "phone", "email", "address")
        }),
        ("Medical Info", {
            "fields": ("blood_group", "allergies", "medical_history")
        }),
        ("Family", {
            "fields": ("family",)
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )
