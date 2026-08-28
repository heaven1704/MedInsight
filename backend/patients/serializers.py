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


class AddFamilyMemberSerializer(serializers.Serializer):
    patient_id = serializers.PrimaryKeyRelatedField(
        queryset=Patient.objects.all(), source="patient"
    )


class PatientSerializer(serializers.ModelSerializer):
    """
    Full patient serializer used for retrieve / create / update.

    Clinical fields (allergies, medical_history) are gated behind
    has_clinical_access(). While ENFORCE_CLINICAL_ACCESS=False this is
    completely transparent — the hook is in place for when the flag is
    flipped without needing to change this file.
    """

    family_detail = FamilySerializer(source="family", read_only=True)
    age           = serializers.SerializerMethodField()
    last_visited  = serializers.SerializerMethodField()

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
            "age",
            "last_visited",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "family_detail", "age", "last_visited")

    def get_age(self, obj):
        return obj.age

    def get_last_visited(self, obj):
        return obj.last_visited

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
    last_visited = serializers.SerializerMethodField()
    age          = serializers.SerializerMethodField()
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
            "last_visited",
            "age",
        )

    def get_last_visit(self, obj):
        # Consume the prefetched (already date/time-desc sorted) appointment
        # set rather than running a fresh .order_by().first() query per row,
        # which would bypass the prefetch cache and cause an N+1.
        appts = list(obj.appointments.all())
        return appts[0].date if appts else None

    def get_last_visited(self, obj):
        # Appointments are prefetched sorted date/time-desc, so the first
        # completed one in that list is the most recent completed visit.
        # Falls back to the model property for non-prefetched contexts.
        cache = getattr(obj, "_prefetched_objects_cache", None)
        if cache and "appointments" in cache:
            for a in cache["appointments"]:
                if a.status == "completed":
                    return a.date
            return None
        return obj.last_visited

    def get_age(self, obj):
        return obj.age


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
