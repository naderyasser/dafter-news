"""
What an anonymous reader must still be able to fetch.

DEFAULT_PERMISSION_CLASSES is IsAuthenticated — deny by default, so a new
viewset added without an explicit permission_classes line is closed rather
than public. The cost of that default is the opposite risk: a public read
endpoint whose own permission class is ever removed or mistyped stops
serving the SITE, silently, for everyone who is not logged in.

So this pins the public surface from the outside, as an anonymous client,
exactly the way the Next.js frontend fetches it. Every route here is one the
reader-facing site cannot render without.

Deliberately end-to-end through the URLconf rather than unit-testing the
permission classes: the bug this guards against is a wiring bug, and a unit
test on the class would still pass while the route served a 403.
"""
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from content.models import Article, Section

User = get_user_model()

# Every GET the public site makes. A 200 here is the contract.
PUBLIC_READS = [
    "/api/sections/",
    "/api/articles/",
    "/api/tags/",
    "/api/videos/",
    "/api/authors/",
    "/api/breaking/",
    "/api/stories/",
    "/api/settings/",
    "/api/social-links/",
    "/api/ticker/",
    "/api/matches/",
]


class AnonymousReadSurfaceTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        section = Section.objects.create(key="pol", name_ar="سياسة", order=1)
        Article.objects.create(
            title="خبر منشور",
            slug="published-story",
            section=section,
            status="published",
            published_at=timezone.now(),
        )

    def test_every_public_read_endpoint_answers_anonymously(self):
        for url in PUBLIC_READS:
            with self.subTest(url=url):
                res = self.client.get(url)
                self.assertEqual(
                    res.status_code,
                    200,
                    f"{url} must stay readable without a session — the public site fetches it",
                )

    def test_an_unauthenticated_write_is_still_refused(self):
        """The other half: deny-by-default must actually deny."""
        res = self.client.post("/api/articles/", {"title": "تسلل"}, format="json")

        self.assertIn(res.status_code, (401, 403))
        self.assertFalse(Article.objects.filter(title="تسلل").exists())

    def test_a_draft_never_reaches_an_anonymous_reader(self):
        Article.objects.create(title="مسودة سرية", slug="secret-draft", status="draft")

        titles = [a["title"] for a in self.client.get("/api/articles/").data["results"]]

        self.assertIn("خبر منشور", titles)
        self.assertNotIn("مسودة سرية", titles)

    def test_the_dashboard_overview_is_not_public(self):
        """A staff-only endpoint, checked from the anonymous side."""
        res = self.client.get("/api/dashboard/overview/")

        self.assertIn(res.status_code, (401, 403))

    def test_the_user_list_is_not_public(self):
        res = self.client.get("/api/users/")

        self.assertIn(res.status_code, (401, 403))

    def test_ad_placements_are_not_public(self):
        """
        Deliberately NOT in PUBLIC_READS. The public site never fetches /ads/
        — only the staff-gated dashboard page does (getAdPlacements, behind
        requireCapability("ads")), and it carries a session. Asserted here so
        nobody "fixes" a 403 by opening the endpoint.
        """
        res = self.client.get("/api/ads/")

        self.assertIn(res.status_code, (401, 403))
