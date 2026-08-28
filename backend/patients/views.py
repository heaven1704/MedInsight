from django.db.models import Prefetch, Q
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAdmin, IsAdminOrReceptionist, IsDoctor
from appointments.models import Appointment
from .models import Family, Patient
from .serializers import (
    AddToFamilySerializer,
    FamilySerializer,
    PatientListSerializer,
    PatientSerializer,
)


class PatientPagination(PageNumberPagination):
    page_size            = 20
    page_size_query_param = "page_size"
    max_page_size        = 100


# Prefetch appointments newest-first so PatientListSerializer.get_last_visit
# can pick the latest appointment straight from the cache (no N+1).
APPOINTMENTS_PREFETCH = Prefetch(
    "appointments",
    queryset=Appointment.objects.order_by("-date", "-time"),
)


class PatientViewSet(viewsets.ModelViewSet):
    """
    /api/patients/

    list     GET    ?search=<term>  — searches full_name and phone
    retrieve GET    /api/patients/{id}/
    create   POST   Admin / Receptionist only
    update   PUT    Admin / Receptionist / Doctor (clinical fields)
    partial  PATCH  same as update
    destroy  DELETE Admin only

    Extra actions
    -------------
    GET  /api/patients/{id}/possible-family/
         Returns other patients sharing the same phone or address who are
         NOT already in the same family as this patient.

    POST /api/patients/{id}/add-to-family/
         Body: { "other_patient_id": <int> }
         Creates or joins a Family record linking both patients.
    """

    queryset           = Patient.objects.select_related("family").prefetch_related(APPOINTMENTS_PREFETCH)
    pagination_class   = PatientPagination
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["full_name", "phone", "email"]
    ordering_fields    = ["full_name", "date_of_birth", "created_at"]
    ordering           = ["full_name"]

    def get_permissions(self):
        if self.action in ("list", "retrieve", "possible_family"):
            # All authenticated roles can read
            return [IsAuthenticated()]
        if self.action in ("create", "update", "partial_update"):
            # Admins, receptionists, and doctors can write
            return [IsAuthenticated(), (IsAdminOrReceptionist() or IsDoctor())]
        if self.action == "destroy":
            return [IsAuthenticated(), IsAdmin()]
        # add_to_family — any authenticated user
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "list":
            return PatientListSerializer
        return PatientSerializer

    # ------------------------------------------------------------------ #
    #  Extra action: possible-family                                       #
    # ------------------------------------------------------------------ #

    @action(detail=True, methods=["get"], url_path="possible-family")
    def possible_family(self, request, pk=None):
        """
        GET /api/patients/{id}/possible-family/

        Returns other patients who share the same phone number OR address
        as this patient but are NOT already in the same family group.
        """
        patient = self.get_object()

        qs = (
            Patient.objects.select_related("family")
            .prefetch_related(APPOINTMENTS_PREFETCH)
            .exclude(pk=patient.pk)
        )

        # Build the similarity filter
        similarity_q = Q()
        if patient.phone:
            similarity_q |= Q(phone=patient.phone)
        if patient.address:
            similarity_q |= Q(address__iexact=patient.address)

        if not similarity_q:
            return Response([], status=status.HTTP_200_OK)

        qs = qs.filter(similarity_q)

        # Exclude patients already in the same family
        if patient.family_id:
            qs = qs.exclude(family=patient.family)

        serializer = PatientListSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    # ------------------------------------------------------------------ #
    #  Extra action: add-to-family                                         #
    # ------------------------------------------------------------------ #

    @action(detail=True, methods=["post"], url_path="add-to-family")
    def add_to_family(self, request, pk=None):
        """
        POST /api/patients/{id}/add-to-family/
        Body: { "other_patient_id": <int> }

        Rules:
        - If patient A already belongs to a family, the other patient joins
          that family (and their existing family is dissolved if it has no
          other members).
        - If neither belongs to a family, a new Family is created using
          patient A's last name as the family name.
        - If both already belong to different families, the other patient
          moves into patient A's family.
        """
        patient = self.get_object()
        serializer = AddToFamilySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        other_id = serializer.validated_data["other_patient_id"]
        if other_id == patient.pk:
            return Response(
                {"detail": "A patient cannot be added to a family with themselves."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        other = Patient.objects.get(pk=other_id)

        # Determine (or create) the target family
        if patient.family:
            family = patient.family
        elif other.family:
            family = other.family
        else:
            # Neither has a family — create one named after patient A
            last_name = patient.full_name.split()[-1] if patient.full_name else "Family"
            family = Family.objects.create(family_name=f"{last_name} Family")

        # Clean up the other patient's old family if it becomes empty
        old_family = other.family
        if old_family and old_family.pk != family.pk:
            other.family = family
            other.save(update_fields=["family"])
            if not old_family.members.exists():
                old_family.delete()
        else:
            other.family = family
            other.save(update_fields=["family"])

        # Make sure patient A is also in the family
        if patient.family_id != family.pk:
            patient.family = family
            patient.save(update_fields=["family"])

        return Response(
            FamilySerializer(family).data,
            status=status.HTTP_200_OK,
        )


# --------------------------------------------------------------------------- #
#  Family views                                                                #
# --------------------------------------------------------------------------- #

class FamilyMembersView(viewsets.ReadOnlyModelViewSet):
    """
    /api/families/

    list     GET  /api/families/
    retrieve GET  /api/families/{id}/
    members  GET  /api/families/{id}/members/
    """

    queryset           = Family.objects.prefetch_related("members")
    serializer_class   = FamilySerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=["get"], url_path="members")
    def members(self, request, pk=None):
        """
        GET /api/families/{id}/members/
        Returns the full patient list for a family group.
        """
        family = self.get_object()
        patients = family.members.select_related("family").prefetch_related(APPOINTMENTS_PREFETCH)
        serializer = PatientListSerializer(patients, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)
