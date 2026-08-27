from django.db import models

from patients.models import Patient


def patient_document_upload_path(instance, filename):
    """Store uploads under media/patients/<patient_id>/documents/<filename>."""
    return f"patients/{instance.patient_id}/documents/{filename}"


class Document(models.Model):
    """
    A file (PDF, image, etc.) attached to a Patient record.

    processing_status is included now so that a future OCR / AI service
    can update the field without requiring a schema migration later.
    """

    class DocumentType(models.TextChoices):
        PRESCRIPTION    = "prescription",    "Prescription"
        LAB_REPORT      = "lab_report",      "Lab Report"
        INVOICE         = "invoice",         "Invoice"
        MEDICAL_RECORD  = "medical_record",  "Medical Record"
        OTHER           = "other",           "Other"

    class ProcessingStatus(models.TextChoices):
        UPLOADED      = "uploaded",      "Uploaded"
        PROCESSING    = "processing",    "Processing"
        PROCESSED     = "processed",     "Processed"
        NEEDS_REVIEW  = "needs_review",  "Needs Review"

    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    file = models.FileField(upload_to=patient_document_upload_path)
    document_type = models.CharField(
        max_length=20,
        choices=DocumentType.choices,
        default=DocumentType.OTHER,
    )
    # Comma-separated tags, e.g. "cardiology,2026,dr-smith"
    # A proper M2M Tag model can replace this in a future step if needed.
    tags = models.CharField(max_length=500, blank=True, default="")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    processing_status = models.CharField(
        max_length=15,
        choices=ProcessingStatus.choices,
        default=ProcessingStatus.UPLOADED,
    )

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"{self.get_document_type_display()} — {self.patient} ({self.uploaded_at:%Y-%m-%d})"
