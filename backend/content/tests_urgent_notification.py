"""
The site-wide floating notification — /api/urgent-notification/.

No stored "currently active" record: the newest published, notify_urgent
article inside a 24h window simply *is* the active one. These tests pin that
computed-not-stored semantics, since a regression here means either a stale
notification lingers past its 24h, or a fresher one fails to override.
"""
import datetime

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from content.models import Article, Section


class UrgentNotificationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.section = Section.objects.create(key="egypt", name_ar="شؤون مصر", order=1)
        cls.client = APIClient()

    def make(self, title, minutes_ago, **kw):
        return Article.objects.create(
            title=title,
            slug=kw.pop("slug", title.replace(" ", "-")),
            section=self.section,
            status=kw.pop("status", Article.Status.PUBLISHED),
            language=kw.pop("language", "ar"),
            notify_urgent=kw.pop("notify_urgent", True),
            published_at=timezone.now() - datetime.timedelta(minutes=minutes_ago),
            **kw,
        )

    def get(self, language="ar"):
        return self.client.get("/api/urgent-notification/", {"language": language})

    def test_no_urgent_article_returns_an_empty_object(self):
        self.make("عادي", 5, notify_urgent=False)

        data = self.get().json()

        # Not `None`/204 — DRF's JSONRenderer turns `None` into a genuinely
        # empty body with no Content-Type, which a `fetch().then(r=>r.json())`
        # on the frontend can't parse. `{}` is always valid JSON.
        self.assertEqual(data, {})

    def test_returns_the_urgent_article_with_its_label_and_link(self):
        self.make("زلزال يضرب المنطقة", 5, notify_label="عاجل الآن")

        data = self.get().json()

        self.assertEqual(data["title"], "زلزال يضرب المنطقة")
        self.assertEqual(data["label"], "عاجل الآن")
        self.assertEqual(data["href"], "/article/زلزال-يضرب-المنطقة")

    def test_falls_back_to_a_default_label_when_none_was_typed(self):
        self.make("خبر بلا وصف", 5, notify_label="")

        data = self.get().json()

        self.assertEqual(data["label"], "خبر عاجل")

    def test_a_fresher_urgent_article_overrides_the_older_one(self):
        self.make("الخبر القديم", 60)
        self.make("الخبر الأحدث", 5)

        data = self.get().json()

        # Both are within the 24h window, but only the newest ever surfaces —
        # there is no "cancel the old one" step, it's just never queried.
        self.assertEqual(data["title"], "الخبر الأحدث")

    def test_drops_off_after_24_hours_with_nothing_to_undo(self):
        self.make("خبر قديم جداً", 25 * 60)

        data = self.get().json()

        self.assertEqual(data, {})

    def test_a_draft_never_notifies_even_if_flagged_urgent(self):
        self.make("مسودة عاجلة", 5, status=Article.Status.DRAFT)

        data = self.get().json()

        self.assertEqual(data, {})

    def test_editions_dont_leak_into_each_other(self):
        self.make("Arabic urgent", 5, language="ar")

        self.assertIn("id", self.get("ar").json())
        self.assertEqual(self.get("en").json(), {})

    def test_english_edition_links_to_the_english_article_route(self):
        self.make("Flood warning issued", 5, language="en")

        data = self.get("en").json()

        self.assertEqual(data["href"], "/en/article/Flood-warning-issued")

    def test_publishing_with_notify_urgent_through_the_editor_shows_up_here(self):
        """End-to-end regression, the client's exact report: publish a new
        article from the dashboard editor with «إشعار عاجل» ticked. The
        editor's save PATCH never sends published_at — nothing did, until
        Article.save() started stamping it — so this is the actual path
        that silently broke: a real publish, through the real API, with
        nothing but status and notify_urgent set by hand."""
        from django.contrib.auth import get_user_model

        User = get_user_model()
        client = APIClient()
        client.force_authenticate(User.objects.create_user(username="editor", password="pw", is_staff=True))

        res = client.post(
            "/api/articles/",
            {
                "title": "خبر عاجل من غرفة الأخبار",
                "section": self.section.id,
                "status": "published",
                "notify_urgent": True,
                "notify_label": "عاجل",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)

        data = self.get("ar").json()

        self.assertEqual(data.get("title"), "خبر عاجل من غرفة الأخبار")
