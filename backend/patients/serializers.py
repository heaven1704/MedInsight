from django.conf import settings
from rest_framework import serializers

from accounts.permissions import has_clinical_access
from .models import Family, Patient


class FamilySerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()

    class Meta:
        model  = Family
        fields = ("id", "family_name", "member_count", "created_at")
        read_only_fields = ("id", "created_at", "member_count")

    def get_member_count(self, obj):
        return obj.members.count()


class PatientSerializer(serializers.ModelSerializer):
    """
    Full patient serializer used for retrieve / create / update.

    Clinical fields (allergies, medical_history) are gated behind
    has_clinical_access(). While ENFORCE_CLINICAL_ACCESS=False this is
    completely transparent — the hook is in place for when the flag is
    flipped without needing to change this file.
    """

    family_detail = FamilySerializer(source="family", read_only=True)

    class Meta:
        model  = Patient
        fields = (
            "id",
            "full_name",
            "date_of_birth",
            "gender",
            "phone",
            "email",
            "address",
            "blood_group",
            "allergies",
            "medical_history",
            "family",
            "family_detail",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "family_detail")

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")

        # Enforce clinical-field visibility when the flag is on.
        if request and not has_clinical_access(request.user, instance):
            data["allergies"]       = None
            data["medical_history"] = None

        return data


class PatientListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for the list view — avoids sending large
    text blobs (allergies, medical_history) for every row in the table.
    last_visit is the date of the most recent appointment, if any.
    """

    last_visit   = serializers.SerializerMethodField()
    family_name  = serializers.CharField(source="family.family_name", read_only=True, default=None)

    class Meta:
        model  = Patient
        fields = (
            "id",
            "full_name",
            "date_of_birth",
            "gender",
            "phone",
            "email",
            "blood_group",
            "family",
            "family_name",
            "last_visit",
        )

    def get_last_visit(self, obj):
        appt = obj.appointments.order_by("-date", "-time").first()
        return appt.date if appt else None


class AddToFamilySerializer(serializers.Serializer):
    """Body for POST /api/patients/{id}/add-to-family/"""

    other_patient_id = serializers.IntegerField()

    def validate_other_patient_id(self, value):
        try:
            Patient.objects.get(pk=value)
        except Patient.DoesNotExist:
            raise serializers.ValidationError(
                f"Patient with id {value} does not exist."
            )
        return value
