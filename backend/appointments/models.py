from django.conf import settings
from django.db import models

from patients.models import Patient


class Appointment(models.Model):
    """
    An appointment links a Patient to a doctor (User with role=doctor).

    The doctor FK uses settings.AUTH_USER_MODEL so it stays decoupled from
    a direct import of the User model.  The limit_choices_to kwarg filters
    the admin/form dropdowns to doctors only — it does NOT enforce a DB
    constraint (that's handled at the serializer/view layer in Step 3).

    The composite index on (date, status) covers the most common query
    pattern: "show me all scheduled appointments for today".
    """

    class Status(models.TextChoices):
        SCHEDULED  = "scheduled",  "Scheduled"
        COMPLETED  = "completed",  "Completed"
        CANCELLED  = "cancelled",  "Cancelled"
        NO_SHOW    = "no_show",    "No Show"

    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name="appointments",
    )
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="appointments",
        limit_choices_to={"role": "doctor"},
    )
    date   = models.DateField()
    time   = models.TimeField()
    reason = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.SCHEDULED,
    )

    class Meta:
        indexes = [
            models.Index(fields=["date", "status"], name="appt_date_status_idx"),
        ]
        ordering = ["date", "time"]

    def __str__(self):
        return (
            f"{self.patient} — {self.date} {self.time} "
            f"[{self.get_status_display()}]"
        )
