"""Tests for the media library grid (DashMedia)."""
from django.test import TestCase
from rest_framework.test import APITestCase

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
