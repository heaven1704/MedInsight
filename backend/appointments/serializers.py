from datetime import timedelta

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Appointment

User = get_user_model()

# ── Nested display serializers ─────────────────────────────────────────────

class PatientMinimalSerializer(serializers.Serializer):
    """Read-only patient summary embedded in appointment responses."""
    id        = serializers.IntegerField()
    full_name = serializers.CharField()
    phone     = serializers.CharField()


class DoctorMinimalSerializer(serializers.Serializer):
    """Read-only doctor summary embedded in appointment responses."""
    id        = serializers.IntegerField()
    full_name = serializers.SerializerMethodField()
    username  = serializers.CharField()

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


# ── Overlap detection helper ───────────────────────────────────────────────

# A booking window is considered conflicting if it falls within ±30 minutes
# of an existing appointment for the same doctor on the same date.
OVERLAP_WINDOW_MINUTES = 30


def detect_overlap(doctor_id, date, time, exclude_id=None):
    """
    Return a list of conflicting Appointment objects for the given
    doctor/date/time within OVERLAP_WINDOW_MINUTES.

    Decision: overlaps are ALLOWED but surfaced as a warning field in the
    response so the receptionist sees the conflict and can decide.
    Hard-blocking would disrupt demos and real clinics that double-book.
    """
    from datetime import datetime, time as time_type
    import datetime as dt

    # Build a datetime for comparison arithmetic
    base_dt = datetime.combine(date, time)
    window  = timedelta(minutes=OVERLAP_WINDOW_MINUTES)

    qs = Appointment.objects.filter(
        doctor_id=doctor_id,
        date=date,
        status__in=[Appointment.Status.SCHEDULED],
    )
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)

    conflicts = []
    for appt in qs:
        appt_dt = datetime.combine(appt.date, appt.time)
        if abs(base_dt - appt_dt) < window:
            conflicts.append(appt)
    return conflicts


# ── Main serializer ────────────────────────────────────────────────────────

class AppointmentSerializer(serializers.ModelSerializer):
    """
    Full serializer for create / retrieve / update.

    Read-only nested fields (patient_detail, doctor_detail) are returned
    alongside the writable FK ids (patient, doctor) so the frontend never
    needs a second request to display names.

    A non-fatal `warnings` list is included in the response when an overlap
    is detected.  The appointment is still saved — see detect_overlap().
    """

    patient_detail = serializers.SerializerMethodField(read_only=True)
    doctor_detail  = serializers.SerializerMethodField(read_only=True)

    # Computed after save — populated in to_representation
    warnings = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model  = Appointment
        fields = (
            "id",
            "patient",
            "patient_detail",
            "doctor",
            "doctor_detail",
            "date",
            "time",
            "reason",
            "status",
            "warnings",
        )
        read_only_fields = ("id", "patient_detail", "doctor_detail", "warnings")

    # ── Nested getters ──────────────────────────────────────────────────

    def get_patient_detail(self, obj):
        if obj.patient_id:
            return {
                "id":        obj.patient.id,
                "full_name": obj.patient.full_name,
                "phone":     obj.patient.phone,
            }
        return None

    def get_doctor_detail(self, obj):
        if obj.doctor_id:
            d = obj.doctor
            return {
                "id":        d.id,
                "username":  d.username,
                "full_name": d.get_full_name() or d.username,
            }
        return None

    def get_warnings(self, obj):
        """Populated via context set by the view after save."""
        return self.context.get("warnings", [])

    # ── Validation ──────────────────────────────────────────────────────

    def validate_doctor(self, value):
        if value and value.role != "doctor":
            raise serializers.ValidationError(
                f"{value.username} does not have the doctor role."
            )
        return value

    def validate(self, attrs):
        # Only check overlap on create/update when doctor + date + time are all present
        doctor = attrs.get("doctor") or (self.instance.doctor if self.instance else None)
        date   = attrs.get("date")   or (self.instance.date   if self.instance else None)
        time   = attrs.get("time")   or (self.instance.time   if self.instance else None)

        if doctor and date and time:
            exclude_id = self.instance.pk if self.instance else None
            conflicts  = detect_overlap(doctor.pk, date, time, exclude_id=exclude_id)
            if conflicts:
                # Store conflict info in context so get_warnings() can surface it
                self.context["warnings"] = [
                    f"Overlaps with appointment #{c.pk} for "
                    f"{c.patient.full_name} at {c.time.strftime('%H:%M')}"
                    for c in conflicts
                ]
        return attrs


# ── Lightweight list serializer ────────────────────────────────────────────

class AppointmentListSerializer(serializers.ModelSerializer):
    """Used by the list action — omits heavy fields, embeds display names."""

    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    doctor_name  = serializers.SerializerMethodField()

    class Meta:
        model  = Appointment
        fields = (
            "id",
            "patient",
            "patient_name",
            "doctor",
            "doctor_name",
            "date",
            "time",
            "reason",
            "status",
        )

    def get_doctor_name(self, obj):
        if obj.doctor_id:
            return obj.doctor.get_full_name() or obj.doctor.username
        return None


# ── Status-change serializer ───────────────────────────────────────────────

class AppointmentStatusSerializer(serializers.Serializer):
    """Body for PATCH /api/appointments/{id}/status/"""

    VALID_TRANSITIONS = {
        Appointment.Status.SCHEDULED: [
            Appointment.Status.COMPLETED,
            Appointment.Status.CANCELLED,
            Appointment.Status.NO_SHOW,
        ],
        Appointment.Status.COMPLETED:  [],   # terminal
        Appointment.Status.CANCELLED:  [Appointment.Status.SCHEDULED],  # re-open
        Appointment.Status.NO_SHOW:    [Appointment.Status.SCHEDULED],  # re-open
    }

    status = serializers.ChoiceField(choices=Appointment.Status.choices)

    def validate_status(self, value):
        if self.instance:
            current    = self.instance.status
            allowed    = self.VALID_TRANSITIONS.get(current, [])
            if value not in allowed and value != current:
                raise serializers.ValidationError(
                    f"Cannot transition from '{current}' to '{value}'. "
                    f"Allowed: {[s for s in allowed] or 'none (terminal state)'}."
                )
        return value
