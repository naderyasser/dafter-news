"""Tests for the media library grid (DashMedia)."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase

from content.models import Article
from media_library.models import MediaAsset


class MediaAssetTests(TestCase):
    def test_str_prefers_alt_text(self):
        asset = MediaAsset.objects.create(image="library/x.jpg", alt="محور الدلتا", credit="الدفتر نيوز")

        self.assertEqual(str(asset), "محور الدلتا")

    def test_str_falls_back_to_id_when_alt_is_blank(self):
        asset = MediaAsset.objects.create(image="library/y.jpg")

        self.assertEqual(str(asset), f"Asset #{asset.pk}")

    def test_assets_are_newest_first(self):
        MediaAsset.objects.create(image="a.jpg", alt="قديم")
        MediaAsset.objects.create(image="b.jpg", alt="جديد")

        self.assertEqual(MediaAsset.objects.first().alt, "جديد")


class MediaAssetAPITests(APITestCase):
    """
    The library is newsroom-only (see tests_permissions.py for why), so these
    sign in first — they are about what the grid renders, not about who may
    see it.
    """

    def setUp(self):
        self.client.force_authenticate(
            get_user_model().objects.create_user(username="editor", password="pw", is_staff=True)
        )

    def test_empty_library_returns_an_empty_page_not_an_error(self):
        """The dashboard renders an empty state — it must not 500."""
        res = self.client.get("/api/media/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["count"], 0)

    def test_list_exposes_alt_and_credit(self):
        MediaAsset.objects.create(image="library/z.jpg", alt="مؤتمر", credit="رويترز")

        res = self.client.get("/api/media/")
        row = res.json()["results"][0]

        self.assertEqual(row["alt"], "مؤتمر")
        self.assertEqual(row["credit"], "رويترز")

    def test_list_exposes_linked_article_kind(self):
        """The dashboard grid's click-through must route an opinion piece to
        /opinion/[slug] rather than /article/[slug], which 404s anything
        that isn't kind="news" — see content/serializers.py's
        related_article_kind for the same fix on the in-body related box."""
        article = Article.objects.create(title="عمود رأي", slug="op-1", kind=Article.Kind.OPINION)
        MediaAsset.objects.create(image="library/w.jpg", alt="كاتب", article=article)

        res = self.client.get("/api/media/")
        row = res.json()["results"][0]

        self.assertEqual(row["article_kind"], "opinion")

    def test_list_article_kind_is_none_without_a_linked_article(self):
        MediaAsset.objects.create(image="library/v.jpg", alt="بلا خبر")

        res = self.client.get("/api/media/")
        row = res.json()["results"][0]

        self.assertIsNone(row["article_kind"])
