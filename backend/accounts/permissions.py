from rest_framework.permissions import BasePermission

from django.conf import settings


class HasRole(BasePermission):
    """
    Reusable role-based permission.

    Usage — restrict a view to one or more roles:

        permission_classes = [IsAuthenticated, HasRole("admin")]
        permission_classes = [IsAuthenticated, HasRole("admin", "doctor")]

    The permission passes if the authenticated user's role is in the
    allowed set.  Unauthenticated requests are always rejected.
    """

    def __init__(self, *roles):
        self.roles = set(roles)

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in self.roles
        )


# Convenience singletons — import these directly in views for brevity.
# e.g.:  permission_classes = [IsAuthenticated, IsAdmin]

class IsAdmin(BasePermission):
    """Allow access only to users with role=admin."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "admin"
        )


class IsDoctor(BasePermission):
    """Allow access only to users with role=doctor."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "doctor"
        )


class IsReceptionist(BasePermission):
    """Allow access only to users with role=receptionist."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "receptionist"
        )


class IsAdminOrDoctor(BasePermission):
    """Allow access to admin or doctor roles."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in {"admin", "doctor"}
        )


class IsAdminOrReceptionist(BasePermission):
    """Allow access to admin or receptionist roles."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in {"admin", "receptionist"}
        )


def has_clinical_access(user, patient) -> bool:
    """
    Determines whether `user` is permitted to access `patient`'s data.

    Current behaviour (ENFORCE_CLINICAL_ACCESS=False):
        Returns True for any authenticated user — full open access for the
        demo / development phase.

    Future behaviour (ENFORCE_CLINICAL_ACCESS=True):
        - Doctors always pass (they have inherent clinical access).
        - Admins require an approved AccessGrant record (not yet built).
        - Receptionists are denied by default (read-only demographic access
          will be scoped separately).

    Callers (serializers, views) should treat a False return as a 403 and
    never need to change their call-site when the flag is flipped.
    """
    if not getattr(settings, "ENFORCE_CLINICAL_ACCESS", False):
        # Demo / development mode — skip all clinical-access checks.
        return True

    # --- Strict mode (future implementation placeholder) -----------------
    if user.role == "doctor":
        return True

    if user.role == "admin":
        # TODO: check for an approved AccessGrant(user, patient) record.
        # For now, fall through to False so the shape is correct when the
        # approval workflow is wired up.
        return False

    # Receptionists and any other roles are denied clinical record access.
    return False
