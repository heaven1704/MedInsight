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

    class ApprovalStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.RECEPTIONIST,
    )
    approval_status = models.CharField(
        max_length=20,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.APPROVED,
    )

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.role})"
