"""
Tests for the client's dashboard batch: the automatic related-news endpoint
and media-library reuse (asset_id on blocks, cover_asset_id on articles).
"""
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from content.models import Article, ArticleBlock, BreakingNewsItem, Section, Story, Tag
from media_library.models import MediaAsset

User = get_user_model()

# 1×1 GIF — enough for ImageField validation without PIL fixtures.
GIF = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"


def publish(**kwargs):
    kwargs.setdefault("status", Article.Status.PUBLISHED)
    return Article.objects.create(**kwargs)


class RelatedEndpointTests(APITestCase):
    def setUp(self):
        self.section = Section.objects.create(key="egypt", name_ar="شؤون مصر")
        self.other_section = Section.objects.create(key="economy", name_ar="حركة السوق")
        self.person = Tag.objects.create(name="الرئيس", slug="الرئيس")
        self.topic = Tag.objects.create(name="الدلتا الجديدة", slug="الدلتا-الجديدة")

        self.article = publish(title="افتتاح المرحلة الثانية", section=self.section)
        self.article.tags.set([self.person, self.topic])

    def related(self, slug=None):
        return self.client.get(f"/api/articles/{slug or self.article.slug}/related/")

    def test_orders_by_shared_tag_count(self):
        one_tag = publish(title="خبر بوسم واحد", section=self.other_section)
        one_tag.tags.set([self.person])
        two_tags = publish(title="خبر بوسمين", section=self.other_section)
        two_tags.tags.set([self.person, self.topic])

        res = self.related()
        self.assertEqual(res.status_code, 200)
        titles = [a["title"] for a in res.data["results"]]
        self.assertEqual(titles[:2], ["خبر بوسمين", "خبر بوسم واحد"])

    def test_falls_back_to_section_when_tags_find_nothing(self):
        neighbour = publish(title="خبر من نفس القسم", section=self.section)
        publish(title="خبر من قسم آخر", section=self.other_section)

        res = self.related()
        titles = [a["title"] for a in res.data["results"]]
        self.assertIn(neighbour.title, titles)
        self.assertNotIn("خبر من قسم آخر", titles)

    def test_excludes_drafts_other_languages_and_self(self):
        draft = Article.objects.create(title="مسودة موسومة", status=Article.Status.DRAFT)
        draft.tags.set([self.person])
        english = publish(title="English tagged", language="en", slug="english-tagged")
        english.tags.set([self.person])

        res = self.related()
        titles = [a["title"] for a in res.data["results"]]
        self.assertNotIn("مسودة موسومة", titles)
        self.assertNotIn("English tagged", titles)
        self.assertNotIn(self.article.title, titles)


class MediaAssetReuseTests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user("editor", password="x", is_staff=True)
        self.client.force_authenticate(self.staff)
        self.section = Section.objects.create(key="egypt", name_ar="شؤون مصر")
        self.asset = MediaAsset.objects.create(
            image=SimpleUploadedFile("leader.gif", GIF, content_type="image/gif"),
            title="الرئيس في افتتاح المحور",
            credit="وكالة الدفتر",
        )

    def test_block_asset_id_reuses_the_library_file(self):
        res = self.client.post(
            "/api/articles/",
            {
                "title": "خبر بصورة من المكتبة",
                "section": self.section.id,
                "blocks": [{"order": 0, "type": "image", "text": "", "caption": "من الافتتاح", "credit": "", "asset_id": self.asset.id}],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        block = ArticleBlock.objects.get(article_id=res.data["id"])
        self.assertEqual(block.image.name, self.asset.image.name)
        # Credit inherited from the library so the copyright line travels
        # with the file.
        self.assertEqual(block.credit, "وكالة الدفتر")

    def test_cover_asset_id_sets_the_cover(self):
        res = self.client.post(
            "/api/articles/",
            {"title": "خبر بغلاف من المكتبة", "section": self.section.id, "cover_asset_id": self.asset.id},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        article = Article.objects.get(pk=res.data["id"])
        self.assertEqual(article.cover_image.name, self.asset.image.name)
        self.assertEqual(article.cover_credit, "وكالة الدفتر")

    def test_push_breaking_and_story_only_fire_for_published(self):
        draft = self.client.post(
            "/api/articles/",
            {"title": "خبر مسودة", "section": self.section.id, "status": "draft", "push_breaking": True, "push_story": True},
            format="json",
        )
        self.assertEqual(draft.status_code, 201, draft.data)
        self.assertEqual(BreakingNewsItem.objects.count(), 0)
        self.assertEqual(Story.objects.count(), 0)

        published = self.client.post(
            "/api/articles/",
            {
                "title": "خبر عاجل مهم",
                "section": self.section.id,
                "status": "published",
                "cover_asset_id": self.asset.id,
                "push_breaking": True,
                "push_story": True,
            },
            format="json",
        )
        self.assertEqual(published.status_code, 201, published.data)
        ticker = BreakingNewsItem.objects.get(text="خبر عاجل مهم")
        self.assertTrue(ticker.active)
        # Clickable, not decorative — the strip entry must lead to the story.
        self.assertEqual(ticker.href, f"/article/{published.data['slug']}")
        story = Story.objects.get(title="خبر عاجل مهم")
        self.assertEqual(story.href, f"/article/{published.data['slug']}")
        self.assertEqual(story.section_id, self.section.id)
        self.assertEqual(story.image.name, self.asset.image.name)

        # Re-saving with the boxes still ticked must not stack duplicates.
        resave = self.client.patch(
            f"/api/articles/{published.data['slug']}/",
            {"status": "published", "push_breaking": True, "push_story": True},
            format="json",
        )
        self.assertEqual(resave.status_code, 200, resave.data)
        self.assertEqual(BreakingNewsItem.objects.filter(text="خبر عاجل مهم").count(), 1)
        self.assertEqual(Story.objects.filter(title="خبر عاجل مهم").count(), 1)

    def test_pinned_round_trips_and_filters(self):
        res = self.client.post(
            "/api/articles/",
            {"title": "خبر مثبت", "section": self.section.id, "status": "published", "pinned": True},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        detail = self.client.get(f"/api/articles/{res.data['slug']}/")
        self.assertTrue(detail.data["pinned"])

        listed = self.client.get("/api/articles/?pinned=true")
        self.assertEqual([a["title"] for a in listed.data["results"]], ["خبر مثبت"])

    def test_keep_image_survives_a_resave_but_only_from_upload_dirs(self):
        create = self.client.post(
            "/api/articles/",
            {
                "title": "خبر يعاد حفظه",
                "section": self.section.id,
                "blocks": [{"order": 0, "type": "image", "text": "", "caption": "", "credit": "", "asset_id": self.asset.id}],
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.data)
        stored = ArticleBlock.objects.get(article_id=create.data["id"]).image.name

        resave = self.client.patch(
            f"/api/articles/{create.data['slug']}/",
            {
                "blocks": [
                    {"order": 0, "type": "image", "text": "", "caption": "بعد التعديل", "credit": "", "keep_image": stored},
                    {"order": 1, "type": "image", "text": "", "caption": "", "credit": "", "keep_image": "../../etc/passwd"},
                ]
            },
            format="json",
        )
        self.assertEqual(resave.status_code, 200, resave.data)
        blocks = list(ArticleBlock.objects.filter(article_id=create.data["id"]).order_by("order"))
        self.assertEqual(blocks[0].image.name, stored)
        self.assertFalse(blocks[1].image)
