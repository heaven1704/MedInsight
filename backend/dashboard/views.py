"""
MedInsight dashboard summary API.

GET /api/dashboard/summary/

Returns everything the dashboard screen needs in a single request so the demo
landing page is instant and never has to fan out to multiple endpoints:

    {
        "total_patients":               int,
        "todays_appointments_count":    int,
        "completed_appointments_count": int,
        "pending_appointments_count":   int,
        "recent_patients":              [PatientListSerializer, ... 5],   // newest first
        "recent_documents":             [... 5, includes processing_status],
        "family_suggestions":           [{ patient, match_count, match_names }, ...]
    }

Aggregates use Count()/filter() on the query set (single grouped SQL queries),
NOT per-row Python loops, so this endpoint stays fast even when it is hit
repeatedly during a demo.

Semantics
---------
* "pending" appointments = those with status = scheduled (booked but not yet
  done). This is the most intuitive reading of "pending" for a clinic.
* "recent" = newest by created_at / uploaded_at.
* "family_suggestions" = among the most recently added patients, any that have
  unresolved possible-family matches (same phone/address as another patient who
  is NOT already in the same family group). This lets the dashboard surface the
  Step 4 family-grouping feature without digging into a patient's Family tab.
"""

from collections import defaultdict

from django.db.models import Prefetch
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from appointments.models import Appointment
from documents.models import Document
from patients.models import Patient
from patients.serializers import PatientListSerializer

RECENT_PATIENTS_LIMIT = 5
RECENT_DOCUMENTS_LIMIT = 5

# Prefetch appointments newest-first so PatientListSerializer.get_last_visit
# picks the latest appointment from the cache instead of one query per patient.
APPOINTMENTS_PREFETCH = Prefetch(
    "appointments",
    queryset=Appointment.objects.order_by("-date", "-time"),
)


def _family_suggestions() -> list[dict]:
    """
    Return unresolved family-grouping suggestions across ALL patients, computed
    in a single pass (one bulk fetch, O(n) Python — no N+1 queries).

    A patient has a suggestion when another patient shares their phone OR
    address but is NOT already in the same Family group. This powers the
    dashboard callout so the Step 4 feature is visible without opening a
    patient's Family tab.
    """
    patients = list(
        Patient.objects.only("id", "full_name", "phone", "address", "family_id")
    )
    if not patients:
        return []

    by_phone: dict[str, list[int]] = defaultdict(list)
    by_address: dict[str, list[int]] = defaultdict(list)
    for p in patients:
        if p.phone:
            by_phone[p.phone].append(p.id)
        if p.address:
            by_address[p.address.casefold()].append(p.id)

    family_of = {p.id: p.family_id for p in patients}
    name_by_id = {p.id: p.full_name for p in patients}

    suggestions = []
    for p in patients:
        peer_ids = set()
        if p.phone:
            peer_ids.update(by_phone[p.phone])
        if p.address:
            peer_ids.update(by_address[p.address.casefold()])
        peer_ids.discard(p.id)
        # A peer is only excluded if BOTH records already share the SAME family
        # group. Two records with no family (None == None) are NOT "grouped" —
        # they are precisely the records we want to suggest grouping.
        my_family = family_of[p.id]
        unmatched = [
            pid for pid in peer_ids
            if not (my_family and family_of[pid] == my_family)
        ]

        if unmatched:
            suggestions.append(
                {
                    "id": p.id,
                    "full_name": p.full_name,
                    "phone": p.phone,
                    "match_count": len(unmatched),
                    "match_names": [name_by_id[pid] for pid in unmatched],
                }
            )

    # Most interesting (i.e. most recent) first; cap the payload.
    suggestions.sort(key=lambda s: -s["id"])
    return suggestions[:10]


class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()

        # ── Efficient aggregates (single queries) ─────────────────────────
        total_patients = Patient.objects.count()
        todays_appointments = (
            Appointment.objects.filter(date=today).count()
        )
        completed_appointments = (
            Appointment.objects.filter(status=Appointment.Status.COMPLETED).count()
        )
        pending_appointments = (
            Appointment.objects.filter(status=Appointment.Status.SCHEDULED).count()
        )

        # ── Recent rows ──────────────────────────────────────────────────
        recent_patients_qs = (
            Patient.objects.select_related("family")
            .prefetch_related(APPOINTMENTS_PREFETCH)
            .order_by("-created_at", "-pk")[:RECENT_PATIENTS_LIMIT]
        )
        recent_patients = PatientListSerializer(
            recent_patients_qs, many=True, context={"request": request}
        ).data

        recent_documents_qs = (
            Document.objects.select_related("patient")
            .order_by("-uploaded_at", "-pk")[:RECENT_DOCUMENTS_LIMIT]
        )
        recent_documents = [
            {
                "id": d.pk,
                "patient_id": d.patient_id,
                "patient_name": d.patient.full_name,
                "document_type": d.document_type,
                "file": d.file.url if d.file else None,
                "uploaded_at": d.uploaded_at,
                "processing_status": d.processing_status,
            }
            for d in recent_documents_qs
        ]

        # ── Family-grouping suggestions ───────────────────────────────────
        family_suggestions = _family_suggestions()

        return Response(
            {
                "total_patients": total_patients,
                "todays_appointments_count": todays_appointments,
                "completed_appointments_count": completed_appointments,
                "pending_appointments_count": pending_appointments,
                "recent_patients": recent_patients,
                "recent_documents": recent_documents,
                "family_suggestions": family_suggestions,
            }
        )
