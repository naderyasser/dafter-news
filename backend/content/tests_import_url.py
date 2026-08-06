"""
«استيراد من رابط» — extraction, the SSRF guard, and the endpoint's contract
that an import always lands as reviewable, credited material rather than a
silent republish. See content/import_url.py's own docstring for why.
"""
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from content import import_url

User = get_user_model()

ARTICLE_HTML = """
<html><head>
  <title>عنوان الصفحة</title>
  <meta property="og:title" content="عنوان الخبر من المصدر">
  <meta property="og:description" content="مقدمة الخبر من المصدر الأصلي.">
  <meta property="og:image" content="/media/cover.jpg">
</head><body>
  <nav><p>الرئيسية</p><p>اتصل بنا</p></nav>
  <article>
    <p>هذه هي الفقرة الأولى من متن الخبر وتحتوي على تفاصيل كافية لتُعتبر محتوى حقيقياً وليس رابط تنقل.</p>
    <p>هذه هي الفقرة الثانية من متن الخبر وتحتوي أيضاً على تفاصيل كافية لتُعتبر جزءاً من المتن الأساسي.</p>
  </article>
  <footer><p>© 2026</p></footer>
</body></html>
"""


def _fake_response(status_code=200, content=b"", headers=None, encoding="utf-8", redirect=False):
    res = MagicMock()
    res.status_code = status_code
    res.headers = headers or {}
    res.encoding = encoding
    res.is_redirect = redirect
    res.is_permanent_redirect = False
    res.iter_content.return_value = [content] if content else []
    return res


class HostGuardTests(APITestCase):
    def test_private_ip_target_is_refused(self):
        with patch("content.import_url.socket.getaddrinfo") as getaddrinfo:
            getaddrinfo.return_value = [(2, 1, 6, "", ("127.0.0.1", 0))]
            self.assertFalse(import_url._is_public_host("internal.example"))

    def test_public_ip_target_is_allowed(self):
        with patch("content.import_url.socket.getaddrinfo") as getaddrinfo:
            getaddrinfo.return_value = [(2, 1, 6, "", ("93.184.216.34", 0))]
            self.assertTrue(import_url._is_public_host("example.com"))

    def test_unresolvable_host_is_refused(self):
        with patch("content.import_url.socket.getaddrinfo", side_effect=OSError):
            self.assertFalse(import_url._is_public_host("does-not-resolve.invalid"))

    def test_extract_refuses_a_url_that_resolves_privately(self):
        """regression path this guard exists for: a staff session pointing
        the importer at the box's own metadata/admin surfaces."""
        with patch("content.import_url.socket.getaddrinfo") as getaddrinfo:
            getaddrinfo.return_value = [(2, 1, 6, "", ("169.254.169.254", 0))]
            with self.assertRaises(import_url.ImportError_):
                import_url.extract_article("http://169.254.169.254/latest/meta-data/")

    def test_non_http_scheme_is_refused(self):
        with self.assertRaises(import_url.ImportError_):
            import_url.extract_article("file:///etc/passwd")


class ExtractionTests(APITestCase):
    def test_pulls_title_description_image_and_the_biggest_paragraph_cluster(self):
        with patch("content.import_url.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("93.184.216.34", 0))]):
            with patch("content.import_url.requests.get", return_value=_fake_response(content=ARTICLE_HTML.encode())):
                data = import_url.extract_article("https://example.com/news/1")

        self.assertEqual(data["title"], "عنوان الخبر من المصدر")
        self.assertEqual(data["standfirst"], "مقدمة الخبر من المصدر الأصلي.")
        self.assertEqual(len(data["paragraphs"]), 2)
        self.assertIn("الفقرة الأولى", data["paragraphs"][0])
        self.assertEqual(data["image_url"], "https://example.com/media/cover.jpg")
        self.assertEqual(data["source_domain"], "example.com")

    def test_short_nav_and_footer_paragraphs_are_not_mistaken_for_the_body(self):
        with patch("content.import_url.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("93.184.216.34", 0))]):
            with patch("content.import_url.requests.get", return_value=_fake_response(content=ARTICLE_HTML.encode())):
                data = import_url.extract_article("https://example.com/news/1")

        self.assertTrue(all(len(p) >= import_url.MIN_PARAGRAPH_CHARS for p in data["paragraphs"]))
        self.assertNotIn("الرئيسية", data["paragraphs"])

    def test_page_with_no_extractable_content_is_refused(self):
        empty = "<html><head><title></title></head><body><nav><p>قائمة</p></nav></body></html>"
        with patch("content.import_url.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("93.184.216.34", 0))]):
            with patch("content.import_url.requests.get", return_value=_fake_response(content=empty.encode())):
                with self.assertRaises(import_url.ImportError_):
                    import_url.extract_article("https://example.com/empty")

    def test_a_redirect_is_followed_only_after_the_new_host_is_re_validated(self):
        redirect_res = _fake_response(status_code=302, headers={"Location": "https://cdn.example.com/final"}, redirect=True)
        final_res = _fake_response(content=ARTICLE_HTML.encode())
        with patch("content.import_url.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("93.184.216.34", 0))]):
            with patch("content.import_url.requests.get", side_effect=[redirect_res, final_res]) as get:
                data = import_url.extract_article("https://example.com/short-link")

        self.assertEqual(get.call_count, 2)
        self.assertEqual(data["source_domain"], "cdn.example.com")

    def test_a_redirect_to_a_private_target_is_refused_not_blindly_followed(self):
        """The guard on the *original* host is worthless if a 302 to
        127.0.0.1 just sails through — this is the actual attack the
        redirect re-validation exists to stop."""
        redirect_res = _fake_response(status_code=302, headers={"Location": "http://127.0.0.1:8300/admin/"}, redirect=True)

        def fake_getaddrinfo(hostname, *args, **kwargs):
            ip = "93.184.216.34" if hostname == "example.com" else "127.0.0.1"
            return [(2, 1, 6, "", (ip, 0))]

        with patch("content.import_url.socket.getaddrinfo", side_effect=fake_getaddrinfo):
            with patch("content.import_url.requests.get", return_value=redirect_res):
                with self.assertRaises(import_url.ImportError_):
                    import_url.extract_article("https://example.com/short-link")

    def test_oversized_page_is_refused(self):
        big = _fake_response(content=b"x" * (import_url.MAX_BYTES + 1))
        with patch("content.import_url.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("93.184.216.34", 0))]):
            with patch("content.import_url.requests.get", return_value=big):
                with self.assertRaises(import_url.ImportError_):
                    import_url.extract_article("https://example.com/huge")


class ImportFromUrlViewTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(User.objects.create_user(username="editor", password="pw", is_staff=True))

    def test_requires_staff(self):
        self.client.force_authenticate(None)
        res = self.client.post("/api/import-from-url/", {"url": "https://example.com"}, format="json")
        self.assertEqual(res.status_code, 403)

    def test_blank_url_is_rejected(self):
        res = self.client.post("/api/import-from-url/", {"url": ""}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_returns_a_draftable_shape_with_the_source_credited(self):
        """The whole point: nothing here auto-publishes, and the byline
        carries the source unless an editor deliberately removes it."""
        with patch("content.import_url.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("93.184.216.34", 0))]):
            with patch("content.import_url.requests.get", return_value=_fake_response(content=ARTICLE_HTML.encode())):
                res = self.client.post("/api/import-from-url/", {"url": "https://example.com/news/1"}, format="json")

        self.assertEqual(res.status_code, 200, res.data)
        body = res.json()
        self.assertEqual(body["title"], "عنوان الخبر من المصدر")
        self.assertEqual(len(body["paragraphs"]), 2)
        self.assertEqual(body["byline"], "منقول عن example.com")
        self.assertEqual(body["cover_credit"], "example.com")
        # No asset without a usable image in the source page.
        self.assertIsNone(body["cover_asset_id"])

    def test_unreachable_url_reports_a_readable_reason_not_a_500(self):
        with patch("content.import_url.socket.getaddrinfo", side_effect=OSError):
            res = self.client.post("/api/import-from-url/", {"url": "https://does-not-resolve.invalid"}, format="json")

        self.assertEqual(res.status_code, 422)
        self.assertIn("تعذّر", res.json()["detail"])

    def test_a_cover_image_that_fails_to_decode_is_skipped_without_failing_the_import(self):
        """Not every og:image is actually reachable or actually an image —
        the text is still worth having even when the picture isn't."""
        html_with_image = ARTICLE_HTML
        with patch("content.import_url.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("93.184.216.34", 0))]):
            with patch(
                "content.import_url.requests.get",
                side_effect=[_fake_response(content=html_with_image.encode()), _fake_response(status_code=404)],
            ):
                res = self.client.post("/api/import-from-url/", {"url": "https://example.com/news/1"}, format="json")

        self.assertEqual(res.status_code, 200, res.data)
        self.assertIsNone(res.json()["cover_asset_id"])

    def test_a_real_cover_image_becomes_a_media_asset_with_the_source_credited(self):
        from io import BytesIO

        from PIL import Image

        from media_library.models import MediaAsset

        buf = BytesIO()
        Image.new("RGB", (10, 10), color="red").save(buf, format="JPEG")
        image_bytes = buf.getvalue()

        with patch("content.import_url.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("93.184.216.34", 0))]):
            with patch(
                "content.import_url.requests.get",
                side_effect=[
                    _fake_response(content=ARTICLE_HTML.encode()),
                    _fake_response(content=image_bytes, headers={"Content-Type": "image/jpeg"}),
                ],
            ):
                res = self.client.post("/api/import-from-url/", {"url": "https://example.com/news/1"}, format="json")

        self.assertEqual(res.status_code, 200, res.data)
        body = res.json()
        self.assertIsNotNone(body["cover_asset_id"])
        asset = MediaAsset.objects.get(pk=body["cover_asset_id"])
        self.assertEqual(asset.credit, "example.com")
        self.assertEqual(asset.license, MediaAsset.License.UNKNOWN)
