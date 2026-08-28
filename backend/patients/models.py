from datetime import date

from django.db import models


class Family(models.Model):
    """
    A lightweight grouping that links related patients (e.g. same household).
    Patients are linked via the Patient.family FK.
    """

    family_name = models.CharField(max_length=255)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Families"
        ordering = ["family_name"]

    def __str__(self):
        return self.family_name


class Patient(models.Model):
    """
    Core patient demographic and medical-history record.
    Indexes are placed on full_name and phone because those are the two
    fields most commonly used as search/lookup keys and for family-match
    detection.
    """

    class Gender(models.TextChoices):
        MALE   = "male",   "Male"
        FEMALE = "female", "Female"
        OTHER  = "other",  "Other"

    class BloodGroup(models.TextChoices):
        A_POS   = "A+",      "A+"
        A_NEG   = "A-",      "A-"
        B_POS   = "B+",      "B+"
        B_NEG   = "B-",      "B-"
        AB_POS  = "AB+",     "AB+"
        AB_NEG  = "AB-",     "AB-"
        O_POS   = "O+",      "O+"
        O_NEG   = "O-",      "O-"
        UNKNOWN = "unknown", "Unknown"

    full_name       = models.CharField(max_length=255)
    date_of_birth   = models.DateField(blank=True, null=True)
    gender          = models.CharField(max_length=10, choices=Gender.choices)
    phone           = models.CharField(max_length=20, blank=True, null=True)
    email           = models.EmailField(blank=True, null=True)
    address         = models.TextField(blank=True, null=True)
    blood_group     = models.CharField(
                          max_length=10,
                          choices=BloodGroup.choices,
                          blank=True,
                          null=True,
                      )
    allergies       = models.TextField(blank=True, null=True)
    medical_history = models.TextField(blank=True, null=True)
    family          = models.ForeignKey(
                          Family,
                          null=True,
                          blank=True,
                          on_delete=models.SET_NULL,
                          related_name="members",
                      )
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["full_name"], name="patient_full_name_idx"),
            models.Index(fields=["phone"],     name="patient_phone_idx"),
        ]
        ordering = ["full_name"]

    @property
    def age(self):
        """Age computed from date_of_birth as of today. None if no DOB set."""
        if not self.date_of_birth:
            return None
        today = date.today()
        return (
            today.year
            - self.date_of_birth.year
            - ((today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day))
        )

    @property
    def last_visited(self):
        """
        The most recent appointment date for this patient where status is
        'completed', or None if there is none.
        """
        last = (
            self.appointments
            .filter(status="completed")
            .order_by("-date", "-time")
            .first()
        )
        return last.date if last else None

    def __str__(self):
        return f"{self.full_name} (DOB: {self.date_of_birth})"
