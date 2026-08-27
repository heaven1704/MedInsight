from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom user model for MedInsight.
    Extends AbstractUser so we keep all the built-in auth machinery
    (password hashing, permissions, etc.) and just add a role field.
    """

    class Role(models.TextChoices):
        ADMIN       = "admin",       "Admin"
        DOCTOR      = "doctor",      "Doctor"
        RECEPTIONIST = "receptionist", "Receptionist"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.RECEPTIONIST,
    )

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.role})"
