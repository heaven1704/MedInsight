from rest_framework import serializers

from patients.models import Patient
from .models import Document


class DocumentSerializer(serializers.ModelSerializer):
    patient = serializers.PrimaryKeyRelatedField(queryset=Patient.objects.all())

    class Meta:
        model = Document
        fields = ("id", "patient", "file", "document_type", "tags", "uploaded_at", "processing_status")
        read_only_fields = ("id", "uploaded_at", "processing_status")

    def validate_file(self, f):
        # Validate extension
        name = f.name.lower()
        allowed_ext = (".pdf", ".jpg", ".jpeg", ".png")
        if not any(name.endswith(ext) for ext in allowed_ext):
            raise serializers.ValidationError("Invalid file type. Only PDF, JPG, PNG are allowed.")

        # Validate size (max 10MB)
        max_bytes = 10 * 1024 * 1024
        if f.size > max_bytes:
            raise serializers.ValidationError("File is too large. Maximum size is 10MB.")

        return f

    def create(self, validated_data):
        # Ensure processing_status is set to uploaded (model default already does this)
        return super().create(validated_data)
