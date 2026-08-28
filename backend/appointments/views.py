from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAdmin
from .models import Appointment
from .serializers import (
    AppointmentListSerializer,
    AppointmentSerializer,
    AppointmentStatusSerializer,
)

User = get_user_model()


class AppointmentPagination(PageNumberPagination):
    page_size             = 25
    page_size_query_param = "page_size"
    max_page_size         = 100


class AppointmentViewSet(viewsets.ModelViewSet):
    """
    /api/appointments/

    list     GET   ?date=YYYY-MM-DD  &status=scheduled  &doctor=<id>  &patient=<id>
    retrieve GET   /api/appointments/{id}/
    create   POST
    update   PUT / PATCH
    destroy  DELETE  (admin only)

    Extra action
    ------------
    PATCH /api/appointments/{id}/status/
        Body: { "status": "completed" }
        Enforces valid transitions; returns the updated appointment.
    """

    queryset = (
        Appointment.objects
        .select_related("patient", "doctor")
        .order_by("date", "time")
    )
    pagination_class  = AppointmentPagination
    filter_backends   = [filters.OrderingFilter]
    ordering_fields   = ["date", "time", "status"]

    def get_permissions(self):
        if self.action == "destroy":
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "list":
            return AppointmentListSerializer
        if self.action == "status_change":
            return AppointmentStatusSerializer
        return AppointmentSerializer

    def get_queryset(self):
        qs = super().get_queryset()

        # ── Filters ───────────────────────────────────────────────────
        date    = self.request.query_params.get("date")
        stat    = self.request.query_params.get("status")
        doctor  = self.request.query_params.get("doctor")
        patient = self.request.query_params.get("patient")

        if date:
            qs = qs.filter(date=date)
        if stat:
            qs = qs.filter(status=stat)
        if doctor:
            qs = qs.filter(doctor_id=doctor)
        if patient:
            qs = qs.filter(patient_id=patient)

        return qs

    # ── Create: run overlap detection and attach warnings ──────────────

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # validate() may have populated warnings in serializer.context
        instance = serializer.save()

        # Re-serialize so warnings flow through to_representation
        out = AppointmentSerializer(
            instance,
            context={"request": request, "warnings": serializer.context.get("warnings", [])},
        )
        headers = self.get_success_headers(out.data)
        return Response(out.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()

        out = AppointmentSerializer(
            instance,
            context={"request": request, "warnings": serializer.context.get("warnings", [])},
        )
        return Response(out.data)

    # ── Status-change action ──────────────────────────────────────────

    @action(detail=True, methods=["patch"], url_path="status")
    def status_change(self, request, pk=None):
        """
        PATCH /api/appointments/{id}/status/
        Body: { "status": "completed" | "cancelled" | "no_show" | "scheduled" }

        Validates transition rules, saves, returns the full updated appointment.
        """
        appointment = self.get_object()
        serializer  = AppointmentStatusSerializer(
            appointment, data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        appointment.status = serializer.validated_data["status"]
        appointment.save(update_fields=["status"])

        out = AppointmentSerializer(appointment, context={"request": request})
        return Response(out.data, status=status.HTTP_200_OK)

    # ── Convenience: today's appointments ────────────────────────────

    @action(detail=False, methods=["get"], url_path="today")
    def today(self, request):
        """
        GET /api/appointments/today/
        Returns all appointments for today ordered by time.
        """
        today = timezone.localdate()
        qs    = self.get_queryset().filter(date=today)
        serializer = AppointmentListSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)
