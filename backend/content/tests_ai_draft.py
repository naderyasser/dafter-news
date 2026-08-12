"""
«توليد بالذكاء الاصطناعي» — the AI-assisted drafting endpoint. Mocks the
Anthropic client throughout; no real network call is ever made in tests.
"""
import json
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from content import ai_draft

User = get_user_model()


def _fake_response(payload, stop_reason="end_turn"):
    block = MagicMock()
    block.type = "text"
    block.text = json.dumps(payload)
    res = MagicMock()
    res.content = [block]
    res.stop_reason = stop_reason
    return res


class GenerateDraftTests(APITestCase):
    def test_missing_api_key_raises_a_readable_error(self):
        with override_settings():
            with patch.dict("os.environ", {}, clear=False):
                import os

                os.environ.pop("ANTHROPIC_API_KEY", None)
                with self.assertRaises(ai_draft.AiDraftError):
                    ai_draft.generate_draft("خبر تجريبي")

    def test_a_refusal_is_reported_as_a_readable_error_not_a_crash(self):
        with patch.dict("os.environ", {"ANTHROPIC_API_KEY": "sk-test"}):
            with patch("content.ai_draft.anthropic.Anthropic") as Client:
                Client.return_value.messages.create.return_value = _fake_response({}, stop_reason="refusal")
                with self.assertRaises(ai_draft.AiDraftError):
                    ai_draft.generate_draft("موضوع حساس")

    def test_returns_the_parsed_draft_shape(self):
        payload = {
            "title": "عنوان مقترح",
            "standfirst": "مقدمة موجزة",
            "paragraphs": ["الفقرة الأولى", "الفقرة الثانية", ""],
        }
        with patch.dict("os.environ", {"ANTHROPIC_API_KEY": "sk-test"}):
            with patch("content.ai_draft.anthropic.Anthropic") as Client:
                Client.return_value.messages.create.return_value = _fake_response(payload)
                draft = ai_draft.generate_draft("خبر تجريبي", "ar")

        self.assertEqual(draft["title"], "عنوان مقترح")
        self.assertEqual(draft["standfirst"], "مقدمة موجزة")
        # A blank trailing paragraph from the model is dropped, not kept as an
        # empty block the editor would have to delete by hand.
        self.assertEqual(draft["paragraphs"], ["الفقرة الأولى", "الفقرة الثانية"])


class AiDraftViewTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(User.objects.create_user(username="editor", password="pw", is_staff=True))

    def test_requires_staff(self):
        self.client.force_authenticate(None)
        res = self.client.post("/api/generate-draft/", {"topic": "خبر"}, format="json")
        self.assertEqual(res.status_code, 403)

    def test_blank_topic_is_rejected(self):
        res = self.client.post("/api/generate-draft/", {"topic": "  "}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_no_api_key_configured_reports_a_clear_error_not_a_500(self):
        with patch.dict("os.environ", {}, clear=False):
            import os

            os.environ.pop("ANTHROPIC_API_KEY", None)
            res = self.client.post("/api/generate-draft/", {"topic": "خبر تجريبي"}, format="json")

        self.assertEqual(res.status_code, 422)
        self.assertIn("ANTHROPIC_API_KEY", res.json()["detail"])

    def test_successful_generation_returns_the_draft(self):
        payload = {"title": "عنوان", "standfirst": "مقدمة", "paragraphs": ["فقرة أولى"]}
        with patch.dict("os.environ", {"ANTHROPIC_API_KEY": "sk-test"}):
            with patch("content.ai_draft.anthropic.Anthropic") as Client:
                Client.return_value.messages.create.return_value = _fake_response(payload)
                res = self.client.post("/api/generate-draft/", {"topic": "خبر تجريبي"}, format="json")

        self.assertEqual(res.status_code, 200, res.data)
        body = res.json()
        self.assertEqual(body["title"], "عنوان")
        self.assertEqual(body["paragraphs"], ["فقرة أولى"])
