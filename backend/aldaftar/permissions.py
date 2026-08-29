"""
Access policy for the API.

Everything shipped with AllowAny, so any anonymous caller could create an
admin-role user, rewrite site settings, upload files or empty a section. The
public site still needs to read almost everything without an account, so the
split is by method rather than by endpoint:

  ReadOnlyOrStaff   public GET, any-staff writes — articles, the media library
  ReadOnlyOrEditor  public GET, editor+ writes — taxonomy, curation, chrome
  ReadOnlyOrAdmin   public GET, admin-only writes — site-wide singletons
  StaffOnly         any staff, no public read — the newsroom's own screens
  EditorOrAdmin     editor+ only, no public read — the desks a writer runs
  ModerationStaff   moderator+ — the comment queue
  AdminOnly         superuser/admin role only — accounts and roles
  PublicSubmission  public POST only, moderator+ for anything else

Two axes, and they are not the same question:

  `is_staff` answers "may this account open the dashboard at all". It is what
  separates an invited team member from a reader who signed up — and readers
  are stored with role=author too (see accounts.auth_views.register), so role
  alone can never be the gate.

  `role` answers "what may they do once inside". A كاتب (author/writer) is
  hired to file stories, not to rename a section, retune the markets ticker or
  rewrite the site's SEO. Before this, every write gate asked only the first
  question, so any staff account could do anything short of touching settings
  or accounts.
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission

#: Roles that run the paper: they shape taxonomy, curation and site chrome.
EDITORIAL_ROLES = frozenset({"admin", "editor"})
#: ...plus the comment queue, which a moderator exists to work.
MODERATION_ROLES = EDITORIAL_ROLES | frozenset({"moderator"})


def _user(request):
    user = getattr(request, "user", None)
    return user if (user and user.is_authenticated) else None


def _is_staff(request):
    user = _user(request)
    return bool(user and (user.is_staff or user.is_superuser))


def _has_role(request, roles):
    """Staff, and holding one of `roles` — or a superuser, who bypasses the
    role table entirely because that is what a superuser is for."""
    user = _user(request)
    if not user:
        return False
    if user.is_superuser:
        return True
    return bool(user.is_staff and getattr(user, "role", None) in roles)


def _is_editor(request):
    return _has_role(request, EDITORIAL_ROLES)


def _is_admin(request):
    user = _user(request)
    if not user:
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


class ReadOnlyOrEditor(BasePermission):
    """
    Anyone may read; only an editor or admin may change.

    For the things a story sits *inside* rather than the story itself — the
    section list, the tag vocabulary, the breaking strip, the stories rail,
    the markets ticker. A كاتب picks which section their piece belongs to
    (that is a field on the article, gated by ReadOnlyOrStaff); renaming or
    deleting the section itself changes every other desk's page and the site
    navigation, which is an editor's call.
    """

    message = "هذا الإجراء يتطلب صلاحية محرر."

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS or _is_editor(request)


class EditorOrAdmin(BasePermission):
    """Editor+ for everything, reads included — desks with no public face."""

    message = "هذا الإجراء يتطلب صلاحية محرر."

    def has_permission(self, request, view):
        return _is_editor(request)


class ModerationStaff(BasePermission):
    """The comment queue: a moderator's whole job, and no writer's business."""

    message = "هذا الإجراء يتطلب صلاحية إشراف على التعليقات."

    def has_permission(self, request, view):
        return _has_role(request, MODERATION_ROLES)


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
    the moderation queue, approving, editing, deleting — is moderation work,
    which is a moderator's or an editor's, not a writer's.
    """

    message = "هذا الإجراء يتطلب صلاحية إشراف على التعليقات."

    def has_permission(self, request, view):
        if request.method == "POST":
            return True
        return _has_role(request, MODERATION_ROLES)


class IsSelf(BasePermission):
    """Row belongs to the caller (saved articles, follows)."""

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        return getattr(obj, "user_id", None) == request.user.id
