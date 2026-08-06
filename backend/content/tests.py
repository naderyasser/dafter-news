"""
Tests for the content app: sections, tags, articles (+ block bodies),
comments and the breaking-news strip, plus the dashboard overview endpoint.

Several tests here are REGRESSIONS for defects found during end-to-end
verification — they are marked with `regression:` in the docstring so it's
obvious why an apparently-odd assertion matters.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from content.models import Article, ArticleBlock, BreakingNewsItem, Comment, Section, Story, Tag

User = get_user_model()


class SectionModelTests(TestCase):
    def test_article_count_only_counts_published(self):
        section = Section.objects.create(key="egypt", name_ar="مصر")
        Article.objects.create(title="منشور", section=section, status=Article.Status.PUBLISHED)
        Article.objects.create(title="مسودة", section=section, status=Article.Status.DRAFT)
        Article.objects.create(title="مراجعة", section=section, status=Article.Status.REVIEW)

        self.assertEqual(section.article_count, 1)

    def test_sections_order_by_order_field(self):
        Section.objects.create(key="sports", name_ar="رياضة", order=3)
        Section.objects.create(key="egypt", name_ar="مصر", order=1)
        Section.objects.create(key="economy", name_ar="اقتصاد", order=2)

        self.assertEqual([s.key for s in Section.objects.all()], ["egypt", "economy", "sports"])


class TagSlugTests(TestCase):
    def test_arabic_slug_is_preserved(self):
        """regression: Django's slugify strips every non-ASCII character, so
        Arabic tag names used to collapse to an empty slug (backfilled as a
        meaningless `tag-0`) and /tag/<name> silently returned no articles."""
        tag = Tag.objects.create(name="الذهب", slug="الذهب")

        tag.full_clean()  # would raise ValidationError without allow_unicode
        self.assertEqual(Tag.objects.get(pk=tag.pk).slug, "الذهب")

    def test_arabic_slug_with_spaces_becomes_dashed(self):
        tag = Tag.objects.create(name="البنية التحتية", slug="البنية-التحتية")

        tag.full_clean()
        self.assertEqual(tag.slug, "البنية-التحتية")


class ArticleSlugTests(TestCase):
    def test_slug_is_derived_from_arabic_title_when_blank(self):
        """regression: the dashboard editor slugified titles in the browser
        with an ASCII-only regex, so every Arabic headline collapsed to
        `article-<timestamp>`. The model now derives the slug server-side."""
        article = Article.objects.create(title="الرئيس يفتتح محور الدلتا")

        self.assertEqual(article.slug, "الرئيس-يفتتح-محور-الدلتا")

    def test_explicit_slug_is_not_overwritten(self):
        article = Article.objects.create(title="عنوان عربي", slug="custom-english-slug")

        self.assertEqual(article.slug, "custom-english-slug")

    def test_duplicate_titles_get_unique_slugs(self):
        first = Article.objects.create(title="عنوان مكرر")
        second = Article.objects.create(title="عنوان مكرر")
        third = Article.objects.create(title="عنوان مكرر")

        self.assertEqual(first.slug, "عنوان-مكرر")
        self.assertEqual(second.slug, "عنوان-مكرر-2")
        self.assertEqual(third.slug, "عنوان-مكرر-3")
        self.assertEqual(len({first.slug, second.slug, third.slug}), 3)

    def test_resaving_an_article_keeps_its_slug(self):
        article = Article.objects.create(title="عنوان ثابت")
        original = article.slug

        article.views = 10
        article.save()

        self.assertEqual(Article.objects.get(pk=article.pk).slug, original)

    def test_title_with_no_word_characters_falls_back(self):
        article = Article.objects.create(title="!!! ???")

        self.assertTrue(article.slug.startswith("article"))


class ArticleReadTimeTests(TestCase):
    def test_read_minutes_counts_standfirst_and_paragraphs_only(self):
        """Read time is words ÷ 200 (brief §11). Headings/quotes/captions are
        deliberately excluded — only standfirst + paragraph blocks count."""
        article = Article.objects.create(title="مقال", standfirst=" ".join(["كلمة"] * 100))
        ArticleBlock.objects.create(article=article, order=0, type=ArticleBlock.Type.PARAGRAPH, text=" ".join(["كلمة"] * 300))
        ArticleBlock.objects.create(article=article, order=1, type=ArticleBlock.Type.HEADING, text=" ".join(["كلمة"] * 500))

        self.assertEqual(article.word_count, 400)
        self.assertEqual(article.read_minutes, 2)

    def test_read_minutes_is_never_zero(self):
        article = Article.objects.create(title="قصير", standfirst="كلمة")

        self.assertEqual(article.read_minutes, 1)

    def test_empty_article_still_reports_one_minute(self):
        article = Article.objects.create(title="فارغ")

        self.assertEqual(article.word_count, 0)
        self.assertEqual(article.read_minutes, 1)


class ArticleAPITests(APITestCase):
    def setUp(self):
        self.section = Section.objects.create(key="egypt", name_ar="مصر", name_en="Egypt")
        self.author = User.objects.create(username="m.eladawy", first_name="محمد", last_name="العدوي", role=User.Role.EDITOR)
        self.published = Article.objects.create(
            title="خبر منشور", slug="published-one", section=self.section, author=self.author,
            status=Article.Status.PUBLISHED, published_at=timezone.now(), views=500,
        )
        self.draft = Article.objects.create(title="مسودة", slug="draft-one", section=self.section, status=Article.Status.DRAFT)

    def test_list_hides_unpublished_by_default(self):
        """The public grids must never leak drafts; the dashboard opts in
        explicitly with ?status=."""
        res = self.client.get("/api/articles/")

        slugs = [a["slug"] for a in res.json()["results"]]
        self.assertIn("published-one", slugs)
        self.assertNotIn("draft-one", slugs)

    def test_list_returns_requested_status(self):
        """Only a staff caller may opt into ?status= — see
        test_anonymous_status_param_does_not_leak_drafts for the flip side."""
        staff = User.objects.create(username="dash-staff", is_staff=True)
        self.client.force_authenticate(staff)

        res = self.client.get("/api/articles/?status=draft")

        slugs = [a["slug"] for a in res.json()["results"]]
        self.assertEqual(slugs, ["draft-one"])

    def test_anonymous_status_param_does_not_leak_drafts(self):
        """regression: the list-time published-only filter used to be an
        opt-out — any ?status= value at all (not just a staff-intended one)
        skipped it, since django-filter applies the filterset field
        afterwards regardless. An anonymous ?status=draft must come back
        empty, not hand over every draft in the database."""
        res = self.client.get("/api/articles/?status=draft")

        self.assertEqual(res.json()["results"], [])

    def test_anonymous_retrieve_of_a_draft_404s(self):
        """regression: get_queryset() only ever restricted the `list` action
        to published articles — `retrieve` (used by both slug and numeric-id
        lookups) applied no filter at all, so an anonymous GET on a draft's
        slug or id returned the full unpublished body."""
        by_slug = self.client.get(f"/api/articles/{self.draft.slug}/")
        by_id = self.client.get(f"/api/articles/{self.draft.pk}/")

        self.assertEqual(by_slug.status_code, 404)
        self.assertEqual(by_id.status_code, 404)

    def test_filter_by_section_key(self):
        other = Section.objects.create(key="sports", name_ar="رياضة")
        Article.objects.create(title="رياضة", slug="sport-one", section=other, status=Article.Status.PUBLISHED)

        res = self.client.get("/api/articles/?section__key=egypt")

        self.assertEqual([a["slug"] for a in res.json()["results"]], ["published-one"])

    def test_filter_by_author_username(self):
        """regression: there was no way to ask the API for "this author's
        articles" at all — app/authors/[username]/page.tsx worked around it by
        fetching the site's 12 most recent articles and filtering client-side,
        so an author whose latest piece fell outside that global top-12 got an
        empty author page despite having published plenty."""
        other_author = User.objects.create(username="other-writer", first_name="كاتب", last_name="آخر", role=User.Role.AUTHOR)
        Article.objects.create(
            title="مقال لكاتب آخر", slug="other-writer-one", section=self.section,
            author=other_author, status=Article.Status.PUBLISHED, published_at=timezone.now(),
        )

        res = self.client.get("/api/articles/", {"author__username": self.author.username})

        self.assertEqual([a["slug"] for a in res.json()["results"]], ["published-one"])

    def test_filter_by_tag_slug_with_arabic(self):
        """regression: the whole point of unicode slugs is that this filter
        resolves — it silently returned zero rows when slugs were `tag-N`."""
        tag = Tag.objects.create(name="الذهب", slug="الذهب")
        self.published.tags.add(tag)

        res = self.client.get("/api/articles/", {"tags__slug": "الذهب"})

        self.assertEqual(res.json()["count"], 1)

    def test_detail_by_slug(self):
        res = self.client.get(f"/api/articles/{self.published.slug}/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["title"], "خبر منشور")

    def test_detail_by_numeric_id(self):
        """regression: the dashboard holds records by id and PATCHes
        /articles/<id>/, while public pages link by slug. Both must resolve."""
        res = self.client.get(f"/api/articles/{self.published.pk}/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["slug"], "published-one")

    def test_detail_by_arabic_slug(self):
        arabic = Article.objects.create(title="عنوان عربي للاختبار", status=Article.Status.PUBLISHED)

        res = self.client.get(f"/api/articles/{arabic.slug}/")

        self.assertEqual(res.status_code, 200)

    def test_unknown_slug_404s(self):
        res = self.client.get("/api/articles/does-not-exist/")

        self.assertEqual(res.status_code, 404)

    def test_detail_includes_computed_read_minutes(self):
        res = self.client.get(f"/api/articles/{self.published.slug}/")

        self.assertIn("read_minutes", res.json())
        self.assertGreaterEqual(res.json()["read_minutes"], 1)

    def test_list_exposes_author_and_status_for_dashboard(self):
        res = self.client.get("/api/articles/?status=published")
        row = res.json()["results"][0]

        self.assertEqual(row["author_name"], "محمد العدوي")
        self.assertEqual(row["author_username"], "m.eladawy")
        self.assertEqual(row["status"], "published")

    def test_manual_byline_wins_over_the_linked_author(self):
        """A typed byline is a deliberate override, not a fallback — it must
        win even when a real account is also linked."""
        self.published.byline = "فريق التحرير"
        self.published.save(update_fields=["byline"])

        row = self.client.get("/api/articles/?status=published").json()["results"][0]

        self.assertEqual(row["author_name"], "فريق التحرير")
        self.assertEqual(row["author_initial"], "ف")
        # No account is linked to this byline, so there is nothing to link
        # to or show a photo for — these correctly stay empty rather than
        # keeping the (now-overridden) account's own username/avatar.
        self.assertIsNone(row["author_username"])

    def test_byline_falls_back_to_the_linked_author_when_blank(self):
        row = self.client.get("/api/articles/?status=published").json()["results"][0]

        self.assertEqual(row["author_name"], "محمد العدوي")
        self.assertEqual(row["author_initial"], self.author.initial)

    def test_article_with_neither_byline_nor_author_reports_no_author(self):
        Article.objects.create(title="بلا كاتب", slug="no-author", status=Article.Status.PUBLISHED, published_at=timezone.now())

        row = next(a for a in self.client.get("/api/articles/").json()["results"] if a["slug"] == "no-author")

        self.assertIsNone(row["author_name"])
        self.assertIsNone(row["author_initial"])

    def test_comment_count_is_annotated_and_orderable(self):
        Comment.objects.create(article=self.published, user_name="سارة", text="تعليق")
        Comment.objects.create(article=self.published, user_name="عمر", text="تعليق آخر")

        res = self.client.get("/api/articles/?ordering=-comment_count")

        self.assertEqual(res.json()["results"][0]["comment_count"], 2)

    def test_search_matches_title(self):
        res = self.client.get("/api/articles/?search=منشور")

        self.assertEqual(res.json()["count"], 1)

    def test_queryset_is_ordered_so_pagination_is_stable(self):
        """regression: annotate() silently drops Meta.ordering, leaving the
        paginator with an unordered queryset — rows could then repeat or be
        skipped between pages."""
        from content.views import ArticleViewSet

        self.assertTrue(ArticleViewSet.queryset.ordered)

    def test_page_size_query_param_is_honoured(self):
        """regression: the frontend sizes every grid with ?page_size=, but
        plain PageNumberPagination ignores it and always served PAGE_SIZE —
        so dashboard tables silently showed 20 rows instead of 50."""
        now = timezone.now()
        for i in range(12):
            Article.objects.create(title=f"مقال {i}", slug=f"size-{i}", status=Article.Status.PUBLISHED, published_at=now)

        res = self.client.get("/api/articles/?page_size=5")

        self.assertEqual(len(res.json()["results"]), 5)

    def test_page_size_is_capped(self):
        res = self.client.get("/api/articles/?page_size=99999")

        self.assertEqual(res.status_code, 200)  # capped, not rejected

    def test_pagination_does_not_repeat_or_drop_rows(self):
        now = timezone.now()
        for i in range(12):
            Article.objects.create(title=f"مقال {i}", slug=f"page-{i}", status=Article.Status.PUBLISHED, published_at=now)

        seen = []
        for page in (1, 2, 3):
            res = self.client.get(f"/api/articles/?page_size=5&page={page}")
            seen += [a["slug"] for a in res.json()["results"]]

        self.assertEqual(len(seen), len(set(seen)), "pagination returned duplicate rows")
        self.assertEqual(len(seen), Article.objects.filter(status="published").count())


class ArticleWriteAPITests(APITestCase):
    def setUp(self):
        self.section = Section.objects.create(key="egypt", name_ar="مصر")
        self.staff = User.objects.create(username="editor-staff", is_staff=True)
        self.client.force_authenticate(self.staff)

    def test_create_without_slug_derives_one(self):
        """regression: the editor no longer sends a slug at all, because the
        browser cannot slugify Arabic. Creation must still succeed."""
        res = self.client.post(
            "/api/articles/",
            {"title": "مقال جديد من المحرر", "status": "draft", "badge": "none", "language": "ar"},
            format="json",
        )

        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()["slug"], "مقال-جديد-من-المحرر")

    def test_country_round_trips_editor_to_card(self):
        """The «الخليج»/«عرب وعالم» country chip: the editor writes it and
        the public card list exposes it, so the photo badge has a source."""
        res = self.client.post(
            "/api/articles/",
            {"title": "الكويت تفتتح المتحف الجديد", "status": "published", "country": "الكويت", "language": "ar"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)

        card = next(a for a in self.client.get("/api/articles/").json()["results"] if a["id"] == res.json()["id"])
        self.assertEqual(card["country"], "الكويت")

    def test_byline_round_trips_editor_to_card(self):
        """The manual byline field: typed in the editor, shown on the public
        card as author_name — with no account required for either end."""
        res = self.client.post(
            "/api/articles/",
            {"title": "بيان صادر عن فريق التحرير", "status": "published", "byline": "فريق التحرير", "language": "ar"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)

        article = Article.objects.get(pk=res.json()["id"])
        self.assertEqual(article.byline, "فريق التحرير")

        card = next(a for a in self.client.get("/api/articles/").json()["results"] if a["id"] == res.json()["id"])
        self.assertEqual(card["author_name"], "فريق التحرير")

    def test_create_with_blocks_and_tags(self):
        res = self.client.post(
            "/api/articles/",
            {
                "title": "مقال ببلوكات",
                "status": "published",
                "section": self.section.pk,
                "blocks": [
                    {"order": 0, "type": "paragraph", "text": "فقرة أولى"},
                    {"order": 1, "type": "quote", "text": "اقتباس"},
                ],
                "tag_names": ["الذهب", "المناخ"],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)

        article = Article.objects.get(pk=res.json()["id"])
        self.assertEqual(article.blocks.count(), 2)
        self.assertEqual(article.blocks.first().type, "paragraph")
        self.assertEqual(set(article.tags.values_list("name", flat=True)), {"الذهب", "المناخ"})

    def test_tag_names_create_tags_with_usable_slugs(self):
        self.client.post("/api/articles/", {"title": "مقال", "tag_names": ["كرة القدم"]}, format="json")

        tag = Tag.objects.get(name="كرة القدم")
        self.assertTrue(tag.slug)
        self.assertNotEqual(tag.slug, "")

    def test_tag_name_with_slash_gets_a_routable_slug(self):
        """regression: _sync_tags used to build a new tag's slug with
        `name.replace(" ", "-")` instead of slugify(allow_unicode=True), so a
        tag name containing "/" (no spaces, so the replace is a no-op) was
        stored with the slash verbatim — an unroutable slug, since DRF's
        router segment pattern excludes "/". The detail route must resolve."""
        res = self.client.post("/api/articles/", {"title": "مقال", "tag_names": ["قسم/فرعي"]}, format="json")
        self.assertEqual(res.status_code, 201, res.data)

        tag = Tag.objects.get(name="قسم/فرعي")
        self.assertNotIn("/", tag.slug)

        detail = self.client.get(f"/api/tags/{tag.slug}/")
        self.assertEqual(detail.status_code, 200)

    def test_update_replaces_blocks(self):
        article = Article.objects.create(title="مقال", slug="a1")
        ArticleBlock.objects.create(article=article, order=0, type="paragraph", text="قديم")

        res = self.client.patch(
            f"/api/articles/{article.pk}/",
            {"blocks": [{"order": 0, "type": "paragraph", "text": "جديد"}]},
            format="json",
        )

        self.assertEqual(res.status_code, 200)
        self.assertEqual(article.blocks.count(), 1)
        self.assertEqual(article.blocks.first().text, "جديد")

    def test_block_justify_flag_round_trips(self):
        """The editor's «ضبط النص» toggle — a plain boolean per block, passed
        straight through _sync_blocks like any other block field."""
        res = self.client.post(
            "/api/articles/",
            {
                "title": "مقال مضبوط النص",
                "blocks": [{"order": 0, "type": "paragraph", "text": "فقرة", "justify": True}],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)

        article = Article.objects.get(pk=res.json()["id"])
        self.assertTrue(article.blocks.first().justify)

    def test_patch_status_by_id(self):
        article = Article.objects.create(title="مقال", slug="a2", status=Article.Status.DRAFT)

        res = self.client.patch(f"/api/articles/{article.pk}/", {"status": "published"}, format="json")

        self.assertEqual(res.status_code, 200)
        article.refresh_from_db()
        self.assertEqual(article.status, "published")

    def test_delete_by_id(self):
        article = Article.objects.create(title="للحذف", slug="a3")

        res = self.client.delete(f"/api/articles/{article.pk}/")

        self.assertEqual(res.status_code, 204)
        self.assertFalse(Article.objects.filter(pk=article.pk).exists())


class ArticleBlockTests(TestCase):
    def test_blocks_are_ordered(self):
        article = Article.objects.create(title="مقال", slug="ordered")
        ArticleBlock.objects.create(article=article, order=2, type="paragraph", text="ثالث")
        ArticleBlock.objects.create(article=article, order=0, type="paragraph", text="أول")
        ArticleBlock.objects.create(article=article, order=1, type="paragraph", text="ثان")

        self.assertEqual([b.text for b in article.blocks.all()], ["أول", "ثان", "ثالث"])

    def test_related_block_exposes_target_slug(self):
        """The in-body «اقرأ أيضاً» card links by slug, so the serializer must
        surface the target's slug and not just its numeric id."""
        target = Article.objects.create(title="المقال المرتبط", slug="target-article")
        article = Article.objects.create(title="مقال", slug="host-article")
        ArticleBlock.objects.create(article=article, order=0, type="related", text=target.title, related_article=target)

        from content.serializers import ArticleBlockSerializer

        data = ArticleBlockSerializer(article.blocks.first()).data
        self.assertEqual(data["related_article_slug"], "target-article")


class CommentAPITests(APITestCase):
    def setUp(self):
        self.article = Article.objects.create(title="مقال", slug="c1", status=Article.Status.PUBLISHED)
        # PublicSubmission allows anonymous POST only — moderation queue
        # reads/edits are staff work.
        self.staff = User.objects.create(username="mod-staff", is_staff=True)
        self.client.force_authenticate(self.staff)

    def test_public_submission_is_pinned_to_pending(self):
        """A reader may submit without an account (PublicSubmission), but a
        POST carrying status="approved" must never skip the queue."""
        self.client.force_authenticate(user=None)

        res = self.client.post(
            "/api/comments/",
            {"article": self.article.pk, "user_name": "قارئ", "text": "تعليق", "status": "approved"},
            format="json",
        )

        self.assertEqual(res.status_code, 201)
        self.assertEqual(Comment.objects.get(pk=res.json()["id"]).status, Comment.Status.PENDING)

    def test_filter_by_status(self):
        Comment.objects.create(article=self.article, user_name="أ", text="1", status=Comment.Status.PENDING)
        Comment.objects.create(article=self.article, user_name="ب", text="2", status=Comment.Status.APPROVED)

        res = self.client.get("/api/comments/?status=pending")

        self.assertEqual(res.json()["count"], 1)

    def test_moderation_patch_changes_status(self):
        comment = Comment.objects.create(article=self.article, user_name="أ", text="نص")

        res = self.client.patch(f"/api/comments/{comment.pk}/", {"status": "approved"}, format="json")

        self.assertEqual(res.status_code, 200)
        comment.refresh_from_db()
        self.assertEqual(comment.status, "approved")

    def test_serializer_includes_article_title(self):
        Comment.objects.create(article=self.article, user_name="أ", text="نص")

        res = self.client.get("/api/comments/")

        self.assertEqual(res.json()["results"][0]["article_title"], "مقال")


class BreakingNewsAPITests(APITestCase):
    def test_ordering_and_active_filter(self):
        BreakingNewsItem.objects.create(text="ثالث", order=3, active=True)
        BreakingNewsItem.objects.create(text="أول", order=1, active=True)
        BreakingNewsItem.objects.create(text="معطّل", order=2, active=False)

        res = self.client.get("/api/breaking/?active=true&ordering=order")

        self.assertEqual([i["text"] for i in res.json()["results"]], ["أول", "ثالث"])

    def test_create_and_toggle(self):
        self.client.force_authenticate(User.objects.create(username="breaking-staff", is_staff=True))

        res = self.client.post(
            "/api/breaking/",
            {"text": "خبر عاجل", "order": 0, "active": True, "expires_at": timezone.now().isoformat()},
            format="json",
        )
        self.assertEqual(res.status_code, 201)

        item_id = res.json()["id"]
        patch = self.client.patch(f"/api/breaking/{item_id}/", {"active": False}, format="json")

        self.assertEqual(patch.status_code, 200)
        self.assertFalse(BreakingNewsItem.objects.get(pk=item_id).active)


class DashboardOverviewTests(APITestCase):
    def setUp(self):
        from siteconfig.models import DailyVisit
        from video.models import Video

        self.staff = User.objects.create(username="overview-staff", is_staff=True)
        self.client.force_authenticate(self.staff)

        section = Section.objects.create(key="egypt", name_ar="مصر")
        author = User.objects.create(username="author1", first_name="كاتب", role=User.Role.AUTHOR)
        Article.objects.create(title="منشور 1", slug="p1", section=section, status=Article.Status.PUBLISHED)
        Article.objects.create(title="منشور 2", slug="p2", section=section, status=Article.Status.PUBLISHED)
        self.in_review = Article.objects.create(title="قيد المراجعة", slug="r1", section=section, author=author, status=Article.Status.REVIEW)
        article = Article.objects.create(title="للتعليقات", slug="c1", status=Article.Status.PUBLISHED)
        Comment.objects.create(article=article, user_name="أ", text="1", status=Comment.Status.PENDING)
        Comment.objects.create(article=article, user_name="ب", text="2", status=Comment.Status.APPROVED)
        Video.objects.create(title="فيديو", slug="v1", views=1000)
        Video.objects.create(title="فيديو 2", slug="v2", views=500)
        DailyVisit.objects.create(date=timezone.localdate(), visits=48204, change_pct=4.2)

    def test_stats_are_computed_from_real_records(self):
        res = self.client.get("/api/dashboard/overview/")
        stats = res.json()["stats"]

        self.assertEqual(stats["visits_today"], 48204)
        self.assertEqual(float(stats["visits_change_pct"]), 4.2)
        self.assertEqual(stats["published_articles"], 3)
        self.assertEqual(stats["pending_comments"], 1)
        self.assertEqual(stats["video_views"], 1500)

    def test_review_queue_only_contains_review_status(self):
        res = self.client.get("/api/dashboard/overview/")
        queue = res.json()["review_queue"]

        self.assertEqual(len(queue), 1)
        self.assertEqual(queue[0]["title"], "قيد المراجعة")
        self.assertEqual(queue[0]["author"], "كاتب")

    def test_chart_bars_are_percentages_of_the_max(self):
        from siteconfig.models import DailyVisit
        import datetime

        today = timezone.localdate()
        DailyVisit.objects.create(date=today - datetime.timedelta(days=1), visits=24102)

        res = self.client.get("/api/dashboard/overview/")
        chart = res.json()["chart"]

        self.assertEqual(len(chart), 2)
        self.assertEqual(max(c["bar_pct"] for c in chart), 100)
        self.assertEqual(min(c["bar_pct"] for c in chart), 50)

    def test_overview_survives_an_empty_database(self):
        Article.objects.all().delete()
        Comment.objects.all().delete()
        from siteconfig.models import DailyVisit
        from video.models import Video

        DailyVisit.objects.all().delete()
        Video.objects.all().delete()

        res = self.client.get("/api/dashboard/overview/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["stats"]["visits_today"], 0)
        self.assertEqual(res.json()["chart"], [])


class SectionTagAPITests(APITestCase):
    def test_section_lookup_by_key(self):
        Section.objects.create(key="economy", name_ar="اقتصاد")

        res = self.client.get("/api/sections/economy/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["name_ar"], "اقتصاد")

    def test_tag_lookup_by_arabic_slug(self):
        """regression: /api/tags/الذهب/ 404'd while slugs were ASCII-stripped."""
        Tag.objects.create(name="الذهب", slug="الذهب")

        res = self.client.get("/api/tags/الذهب/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["name"], "الذهب")


class StoryTests(TestCase):
    def test_stories_order_by_order_then_recency(self):
        s3 = Story.objects.create(title="ثالث", order=3)
        s1 = Story.objects.create(title="أول", order=1)
        s2 = Story.objects.create(title="ثان", order=2)

        self.assertEqual([s.title for s in Story.objects.all()], ["أول", "ثان", "ثالث"])
        self.assertEqual({s1.order, s2.order, s3.order}, {1, 2, 3})

    def test_story_survives_its_section_being_deleted(self):
        """A story is a curated promo slot; losing its section must not take
        the card down with it."""
        section = Section.objects.create(key="art", name_ar="ثقافة وفن")
        story = Story.objects.create(title="قصة", section=section)

        section.delete()
        story.refresh_from_db()

        self.assertIsNone(story.section)
        self.assertTrue(Story.objects.filter(pk=story.pk).exists())


class StoryAPITests(APITestCase):
    def setUp(self):
        self.section = Section.objects.create(key="art", name_ar="ثقافة وفن")
        Story.objects.create(title="قصة مفعّلة", section=self.section, href="/section/art", order=1, active=True)
        Story.objects.create(title="قصة متوقفة", order=2, active=False)

    def test_active_filter_hides_disabled_stories(self):
        res = self.client.get("/api/stories/?active=true")

        titles = [s["title"] for s in res.json()["results"]]
        self.assertEqual(titles, ["قصة مفعّلة"])

    def test_list_exposes_section_name_for_the_card_label(self):
        res = self.client.get("/api/stories/?active=true")

        self.assertEqual(res.json()["results"][0]["section_name"], "ثقافة وفن")

    def test_create_and_reorder(self):
        self.client.force_authenticate(User.objects.create(username="stories-staff", is_staff=True))

        res = self.client.post("/api/stories/", {"title": "قصة جديدة", "order": 9, "active": True}, format="json")
        self.assertEqual(res.status_code, 201)

        patch = self.client.patch(f"/api/stories/{res.json()['id']}/", {"order": 0}, format="json")

        self.assertEqual(patch.status_code, 200)
        self.assertEqual(Story.objects.get(pk=res.json()["id"]).order, 0)

    def test_empty_rail_returns_an_empty_page(self):
        Story.objects.all().delete()

        res = self.client.get("/api/stories/?active=true")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["count"], 0)
