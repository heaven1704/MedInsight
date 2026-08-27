from django.contrib import admin

from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display  = ("patient", "document_type", "processing_status", "uploaded_at")
    list_filter   = ("document_type", "processing_status")
    search_fields = ("patient__full_name", "tags")
    readonly_fields = ("uploaded_at",)
    fieldsets = (
        ("Document", {
            "fields": ("patient", "file", "document_type", "tags")
        }),
        ("Processing", {
            "fields": ("processing_status",)
        }),
        ("Timestamps", {
            "fields": ("uploaded_at",),
            "classes": ("collapse",),
        }),
    )
