"""
Who may read the media library.

The library index is not public. Nothing on the reader-facing site fetches it
— getMediaAssets() is called from DashMedia and MediaLibraryPicker and nowhere
else — while every row carries the credit, the source, the licence and, for a
linked asset, the title and slug of the article it belongs to. That last pair
is serialised with no regard for the article's status, so a public index would
name unpublished stories and hand out their slugs the moment an editor filed a
photo against a draft — the same leak that was closed on /api/articles/.

The uploaded files stay reachable at /media/… as they must; what these tests
hold shut is the index, not the images.
"""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from content.models import Article, Section
from media_library.models import MediaAsset

User = get_user_model()


class MediaLibraryPermissionTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.section = Section.objects.create(key="egypt", name_ar="شؤون مصر", order=1)
        cls.draft = Article.objects.create(
            title="عنوان لم يُنشر بعد",
            slug="unpublished-scoop",
            section=cls.section,
            status=Article.Status.DRAFT,
        )
        cls.asset = MediaAsset.objects.create(
            image="library/scoop.jpg", alt="صورة", credit="رويترز", article=cls.draft
        )
        cls.staff = User.objects.create_user(username="editor", password="pw", is_staff=True)
        cls.reader = User.objects.create_user(username="reader", password="pw")

    def test_anonymous_cannot_list_the_library(self):
        res = self.client.get("/api/media/")

        self.assertEqual(res.status_code, 403)

    def test_anonymous_cannot_read_a_single_asset(self):
        res = self.client.get(f"/api/media/{self.asset.pk}/")

        self.assertEqual(res.status_code, 403)

    def test_a_signed_in_reader_is_no_better_placed_than_an_anonymous_one(self):
        """Having an account is not being newsroom staff."""
        self.client.force_authenticate(self.reader)

        res = self.client.get("/api/media/")

        self.assertEqual(res.status_code, 403)

    def test_a_public_index_would_have_named_the_draft(self):
        """
        Not a policy test — a demonstration of what the closed door was
        protecting, so a future relaxation of the permission class fails here
        with the reason spelled out rather than passing quietly.
        """
        self.client.force_authenticate(self.staff)

        row = self.client.get("/api/media/").json()["results"][0]

        self.assertEqual(row["article_title"], "عنوان لم يُنشر بعد")
        self.assertEqual(row["article_slug"], "unpublished-scoop")

    def test_staff_may_still_read_the_library(self):
        self.client.force_authenticate(self.staff)

        res = self.client.get("/api/media/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["count"], 1)

    def test_staff_may_still_search_and_filter(self):
        self.client.force_authenticate(self.staff)

        self.assertEqual(self.client.get("/api/media/?search=رويترز").json()["count"], 1)
        self.assertEqual(self.client.get("/api/media/?search=لا-يوجد").json()["count"], 0)
        self.assertEqual(self.client.get(f"/api/media/?article={self.draft.pk}").json()["count"], 1)

    def test_anonymous_cannot_write_either(self):
        for method, path in (
            ("post", "/api/media/"),
            ("patch", f"/api/media/{self.asset.pk}/"),
            ("delete", f"/api/media/{self.asset.pk}/"),
        ):
            with self.subTest(method=method):
                res = getattr(self.client, method)(path, {}, format="json")

                self.assertEqual(res.status_code, 403)
        self.assertTrue(MediaAsset.objects.filter(pk=self.asset.pk).exists())
