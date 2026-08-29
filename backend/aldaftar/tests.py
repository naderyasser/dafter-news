"""
Tests for the project-wide API infrastructure in `aldaftar/`.

These five modules are the only ones in the codebase with no tests of their
own, and they are the ones every endpoint depends on: the permission classes
decide who may write anything, the paginator decides how much any grid gets,
the exception handler decides what a blocked delete looks like, the lookup
mixin decides whether a URL resolves at all, and the ordering filter decides
whether a paginated list is stable.

They were covered only incidentally, through whichever viewset happened to
exercise them — so a change here could pass every app's tests and still
break a rule none of them asserts directly.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIRequestFactory, APITestCase

from aldaftar.exceptions import exception_handler
from aldaftar.filters import StableOrderingFilter
from aldaftar.pagination import ConfigurablePageNumberPagination
from aldaftar.permissions import (
    AdminOnly,
    IsSelf,
    PublicSubmission,
    ReadOnlyOrAdmin,
    ReadOnlyOrStaff,
    StaffOnly,
)
from content.models import Article, Section

User = get_user_model()


class PermissionMatrixTests(TestCase):
    """
    Every permission class against every kind of caller.

    A table rather than a test per case: the point of these classes is the
    shape of the matrix — who is allowed to do what — and that is far easier
    to check, and to spot a hole in, when it is written out as one.
    """

    def setUp(self):
        self.factory = APIRequestFactory()
        self.anon = None
        self.reader = User.objects.create_user(username="reader", password="x")
        self.staff = User.objects.create_user(username="editor", password="x", is_staff=True)
        self.admin_by_role = User.objects.create_user(username="boss", password="x", is_staff=True, role="admin")
        self.superuser = User.objects.create_superuser(username="root", password="x")

    def _check(self, permission, method, user):
        request = getattr(self.factory, method.lower())("/api/anything/")
        request.user = user if user is not None else AnonymousUser()
        return permission().has_permission(request, view=None)

    def test_read_only_or_staff(self):
        for user, allowed_write in ((self.anon, False), (self.reader, False), (self.staff, True), (self.superuser, True)):
            self.assertTrue(self._check(ReadOnlyOrStaff, "GET", user), user)
            self.assertIs(self._check(ReadOnlyOrStaff, "POST", user), allowed_write, user)
            self.assertIs(self._check(ReadOnlyOrStaff, "DELETE", user), allowed_write, user)

    def test_read_only_or_admin_does_not_accept_a_plain_editor(self):
        """The settings singleton is visible on every page; an editor being
        able to rewrite it is the case this class exists to prevent."""
        self.assertTrue(self._check(ReadOnlyOrAdmin, "GET", self.staff))
        self.assertFalse(self._check(ReadOnlyOrAdmin, "PUT", self.staff))
        self.assertTrue(self._check(ReadOnlyOrAdmin, "PUT", self.admin_by_role))
        self.assertTrue(self._check(ReadOnlyOrAdmin, "PUT", self.superuser))

    def test_staff_only_closes_the_read_too(self):
        self.assertFalse(self._check(StaffOnly, "GET", self.anon))
        self.assertFalse(self._check(StaffOnly, "GET", self.reader))
        self.assertTrue(self._check(StaffOnly, "GET", self.staff))

    def test_admin_only_closes_the_read_to_editors(self):
        # Accounts carry emails, roles and last_login.
        self.assertFalse(self._check(AdminOnly, "GET", self.staff))
        self.assertTrue(self._check(AdminOnly, "GET", self.admin_by_role))

    def test_public_submission_allows_a_post_and_nothing_else(self):
        """A reader may leave a comment; working the queue is moderation, and
        a كاتب is not a moderator — filing a story does not come with the
        right to approve what readers say about it."""
        moderator = User.objects.create_user(username="mod", password="x", is_staff=True, role="moderator")
        writer = self.staff  # is_staff with the default role: a كاتب

        self.assertTrue(self._check(PublicSubmission, "POST", self.anon))
        for method in ("GET", "PATCH", "DELETE"):
            self.assertFalse(self._check(PublicSubmission, method, self.anon), method)
            self.assertFalse(self._check(PublicSubmission, method, writer), method)
            self.assertTrue(self._check(PublicSubmission, method, moderator), method)
            self.assertTrue(self._check(PublicSubmission, method, self.admin_by_role), method)

    def test_an_unauthenticated_user_object_is_never_staff(self):
        """`_is_staff` reads attributes off whatever `request.user` is; an
        AnonymousUser answers `is_staff` as False but must not raise."""
        request = self.factory.post("/api/anything/")
        request.user = AnonymousUser()
        self.assertFalse(ReadOnlyOrStaff().has_permission(request, view=None))

    def test_is_self_matches_only_the_owner(self):
        request = self.factory.get("/api/saved/")
        request.user = self.reader

        self.assertTrue(IsSelf().has_permission(request, view=None))
        self.assertTrue(IsSelf().has_object_permission(request, None, type("Row", (), {"user_id": self.reader.id})()))
        self.assertFalse(IsSelf().has_object_permission(request, None, type("Row", (), {"user_id": self.staff.id})()))

    def test_is_self_rejects_an_anonymous_caller(self):
        request = self.factory.get("/api/saved/")
        request.user = AnonymousUser()

        self.assertFalse(IsSelf().has_permission(request, view=None))


class ConfigurablePaginationTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.paginator = ConfigurablePageNumberPagination()

    def _page_size(self, query):
        from rest_framework.request import Request

        request = Request(self.factory.get(f"/api/articles/{query}"))
        return self.paginator.get_page_size(request)

    def test_honours_the_requested_page_size(self):
        """Plain PageNumberPagination ignores ?page_size= and serves PAGE_SIZE
        to every caller, which silently truncates the dashboard tables."""
        self.assertEqual(self._page_size("?page_size=4"), 4)
        self.assertEqual(self._page_size("?page_size=50"), 50)

    def test_falls_back_to_the_default_when_unasked(self):
        self.assertEqual(self._page_size(""), self.paginator.page_size)

    def test_caps_the_request_so_a_caller_cannot_ask_for_the_world(self):
        self.assertEqual(self._page_size("?page_size=5000"), 200)

    def test_ignores_a_nonsense_value_rather_than_erroring(self):
        self.assertEqual(self._page_size("?page_size=abc"), self.paginator.page_size)


class ProtectedDeleteHandlerTests(APITestCase):
    def test_a_blocked_delete_is_a_conflict_not_a_server_error(self):
        """regression: Article.section is on_delete=PROTECT, so deleting a
        section that still holds articles raised ProtectedError, which DRF has
        no rule for — the Taxonomy screen showed a 500 for what is an ordinary
        editorial conflict."""
        section = Section.objects.create(key="egypt", name_ar="شؤون مصر")
        Article.objects.create(title="خبر", section=section)
        self.client.force_authenticate(User.objects.create_user(username="ed", is_staff=True, role="editor"))

        res = self.client.delete(f"/api/sections/{section.key}/")

        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("detail", res.data)
        self.assertEqual(res.data["blocked_by_count"], 1)
        self.assertEqual(res.data["blocked_by"], ["خبر"])

    def test_it_names_at_most_ten_blockers(self):
        # The message is for a human to act on, not a dump of the table.
        section = Section.objects.create(key="art", name_ar="ثقافة وفن")
        for i in range(14):
            Article.objects.create(title=f"خبر {i}", section=section)
        self.client.force_authenticate(User.objects.create_user(username="ed2", is_staff=True, role="editor"))

        res = self.client.delete(f"/api/sections/{section.key}/")

        self.assertEqual(res.data["blocked_by_count"], 14)
        self.assertEqual(len(res.data["blocked_by"]), 10)

    def test_anything_else_still_goes_through_drf(self):
        from rest_framework.exceptions import NotFound

        response = exception_handler(NotFound(), {})

        self.assertEqual(response.status_code, 404)

    def test_a_delete_with_nothing_blocking_it_succeeds(self):
        section = Section.objects.create(key="tech", name_ar="علوم وتكنولوجيا")
        self.client.force_authenticate(User.objects.create_user(username="ed3", is_staff=True, role="editor"))

        res = self.client.delete(f"/api/sections/{section.key}/")

        self.assertEqual(res.status_code, 204)
        self.assertFalse(Section.objects.filter(key="tech").exists())


class SlugOrPkLookupTests(APITestCase):
    """The mixin is what lets one route serve both the public URL and the
    dashboard's id-based PATCH."""

    def setUp(self):
        self.article = Article.objects.create(
            title="الرئيس يفتتح محور الدلتا", status=Article.Status.PUBLISHED, published_at=timezone.now()
        )

    def test_resolves_by_arabic_slug(self):
        res = self.client.get(f"/api/articles/{self.article.slug}/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["id"], self.article.id)

    def test_resolves_by_numeric_id(self):
        res = self.client.get(f"/api/articles/{self.article.pk}/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["slug"], self.article.slug)

    def test_an_unknown_key_is_a_404(self):
        self.assertEqual(self.client.get("/api/articles/9999999/").status_code, 404)
        self.assertEqual(self.client.get("/api/articles/لا-يوجد/").status_code, 404)

    def test_lookup_respects_the_queryset_the_view_scopes(self):
        """A draft is filtered out of an anonymous caller's queryset, so the
        mixin must not find it by id either — otherwise the numeric route is
        a way around the published-only rule."""
        draft = Article.objects.create(title="مسودة", status=Article.Status.DRAFT)

        self.assertEqual(self.client.get(f"/api/articles/{draft.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/articles/{draft.slug}/").status_code, 404)


class StableOrderingFilterTests(TestCase):
    """
    The tie-breaker that keeps `?ordering=-views` from returning tied rows in
    a different order on every query (which repeats or drops rows across
    pages). Exercised end-to-end in content's MostReadQueryTests; these cover
    the term-building itself, including the branches that list can't reach.
    """

    class _View:
        ordering_fields = ["views", "published_at", "pk"]
        ordering = None

    def _ordering(self, param):
        request = APIRequestFactory().get(f"/?ordering={param}" if param else "/")
        from rest_framework.request import Request

        return StableOrderingFilter().get_ordering(Request(request), Article.objects.all(), self._View())

    def test_appends_a_unique_tie_breaker(self):
        self.assertEqual(self._ordering("-views"), ["-views", "-published_at", "-pk"])

    def test_does_not_repeat_a_field_already_in_the_ordering(self):
        self.assertEqual(self._ordering("-published_at"), ["-published_at", "-pk"])

    def test_leaves_an_ordering_that_is_already_total_alone(self):
        # `pk` is unique, so nothing further can change the result.
        self.assertEqual(self._ordering("pk"), ["pk"])

    def test_falls_through_when_no_ordering_was_asked_for(self):
        # The queryset's own Meta.ordering applies; adding terms here would
        # silently override it.
        self.assertIsNone(self._ordering(""))
