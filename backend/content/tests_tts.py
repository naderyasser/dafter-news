"""
/api/articles/<slug>/generate_tts/ — the dashboard's «توليد النسخة الصوتية»
button. It used to be a `setTimeout` in the editor with nothing behind it;
these pin the real contract: staff-only, a real failure reports itself
instead of silently flipping to "done", and a success actually updates the
article the player reads from.

edge-tts hits a real external endpoint, so `generate_for_article` is mocked
at the view's import site rather than exercised for real here.
"""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from content.models import Article, Section
from content.tts import TtsError

User = get_user_model()


class GenerateTtsViewTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.section = Section.objects.create(key="egypt", name_ar="شؤون مصر", order=1)

    def make(self, **kw):
        return Article.objects.create(
            title=kw.pop("title", "خبر"),
            slug=kw.pop("slug", "khabar"),
            section=self.section,
            status=kw.pop("status", Article.Status.PUBLISHED),
            **kw,
        )

    def test_anonymous_reader_cannot_trigger_generation(self):
        article = self.make()

        res = self.client.post(f"/api/articles/{article.slug}/generate_tts/")

        self.assertEqual(res.status_code, 403)

    def test_staff_can_trigger_generation(self):
        article = self.make()
        self.client.force_authenticate(User.objects.create_user("editor", password="x", is_staff=True))

        with patch("content.views.generate_for_article", return_value=255) as mocked:
            res = self.client.post(f"/api/articles/{article.slug}/generate_tts/")

        mocked.assert_called_once()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["tts_duration_seconds"], 255)

    def test_a_real_failure_is_reported_not_swallowed_into_a_fake_done(self):
        article = self.make()
        self.client.force_authenticate(User.objects.create_user("editor", password="x", is_staff=True))

        with patch("content.views.generate_for_article", side_effect=TtsError("لا يوجد نص كافٍ في المقال لتحويله إلى صوت.")):
            res = self.client.post(f"/api/articles/{article.slug}/generate_tts/")

        self.assertEqual(res.status_code, 422)
        self.assertIn("لا يوجد نص", res.json()["detail"])


class ScriptForTests(APITestCase):
    """script_for() itself needs no network — worth pinning on its own."""

    @classmethod
    def setUpTestData(cls):
        cls.section = Section.objects.create(key="egypt", name_ar="شؤون مصر", order=1)

    def test_reads_headline_then_standfirst_with_no_body(self):
        from content.tts import script_for

        article = Article.objects.create(
            title="عنوان الخبر",
            slug="a1",
            section=self.section,
            standfirst="مقدمة الخبر.",
        )

        self.assertEqual(script_for(article), "عنوان الخبر\n\nمقدمة الخبر.")
