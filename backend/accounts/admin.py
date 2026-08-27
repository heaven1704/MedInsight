from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Extends the built-in UserAdmin to surface the custom `role` field.
    """
    list_display  = ("username", "email", "first_name", "last_name", "role", "is_staff")
    list_filter   = ("role", "is_staff", "is_superuser", "is_active")
    search_fields = ("username", "email", "first_name", "last_name")

    # Add `role` to the existing fieldsets
    fieldsets = BaseUserAdmin.fieldsets + (
        ("MedInsight Role", {"fields": ("role",)}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("MedInsight Role", {"fields": ("role",)}),
    )
