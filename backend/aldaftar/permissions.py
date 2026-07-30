"""
Access policy for the API.

Everything shipped with AllowAny, so any anonymous caller could create an
admin-role user, rewrite site settings, upload files or empty a section. The
public site still needs to read almost everything without an account, so the
split is by method rather than by endpoint:

  ReadOnlyOrStaff   public GET, staff-only writes — newsroom content
  ReadOnlyOrAdmin   public GET, admin-only writes — site-wide singletons
  StaffOnly         staff for everything — no public read at all
  AdminOnly         superuser/admin role only — accounts and roles
  PublicSubmission  public POST only, staff for anything else — reader comments
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission


def _is_staff(request):
    user = getattr(request, "user", None)
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


def _is_admin(request):
    user = getattr(request, "user", None)
    if not (user and user.is_authenticated):
        return False
    return bool(user.is_superuser or getattr(user, "role", None) == "admin")


class ReadOnlyOrStaff(BasePermission):
    """Anyone may read; only newsroom staff may change."""

    message = "هذا الإجراء يتطلب تسجيل الدخول بحساب من فريق التحرير."

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS or _is_staff(request)


class ReadOnlyOrAdmin(BasePermission):
    """
    Anyone may read; only an admin may change.

    For records the whole site is built from, where a wrong value is visible on
    every page rather than on one story — the settings singleton is the case
    this exists for.
    """

    message = "هذا الإجراء يتطلب صلاحية مدير."

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS or _is_admin(request)


class StaffOnly(BasePermission):
    message = "هذا الإجراء يتطلب تسجيل الدخول بحساب من فريق التحرير."

    def has_permission(self, request, view):
        return _is_staff(request)


class AdminOnly(BasePermission):
    """Accounts carry emails, roles and last_login — admins only, reads included."""

    message = "هذا الإجراء يتطلب صلاحية مدير."

    def has_permission(self, request, view):
        return _is_admin(request)


class PublicSubmission(BasePermission):
    """
    A reader may post a comment without an account; everything else — listing
    the moderation queue, approving, editing, deleting — is staff work.
    """

    message = "هذا الإجراء يتطلب تسجيل الدخول بحساب من فريق التحرير."

    def has_permission(self, request, view):
        if request.method == "POST":
            return True
        return _is_staff(request)


class IsSelf(BasePermission):
    """Row belongs to the caller (saved articles, follows)."""

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        return getattr(obj, "user_id", None) == request.user.id
