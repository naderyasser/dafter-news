"""
Tests for the content app: sections, tags, articles (+ block bodies),
comments and the breaking-news strip, plus the dashboard overview endpoint.

Several tests here are REGRESSIONS for defects found during end-to-end
verification — they are marked with `regression:` in the docstring so it's
obvious why an apparently-odd assertion matters.
"""
import datetime
from unittest import mock

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from content.models import Article, ArticleBlock, BreakingNewsItem, Comment, Section, Story, Tag
from content.serializers import ArticleWriteSerializer

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


class ArticlePublishedAtStampingTests(TestCase):
    """regression: the dashboard's direct «نشر الآن» button PATCHes
    status=published with no published_at in the payload — nothing else
    ever set it, so the field stayed NULL forever. That silently broke the
    urgent-notification popup, whose query filters on
    `published_at__gte=cutoff` (NULL never satisfies a >= comparison): a
    freshly published, notify_urgent=True article never appeared as a
    site-wide alert, reported live as "the notification button does
    nothing". Mirrors the "stamped only if empty" policy
    publish_scheduled.py already applies on the scheduled-publish path."""

    def test_publishing_stamps_published_at_when_it_was_never_set(self):
        article = Article.objects.create(title="خبر عاجل", status=Article.Status.PUBLISHED)

        self.assertIsNotNone(article.published_at)

    def test_a_draft_is_not_stamped(self):
        article = Article.objects.create(title="مسودة")

        self.assertIsNone(article.published_at)

    def test_an_earlier_published_at_is_never_overwritten_on_resave(self):
        original = timezone.now() - datetime.timedelta(days=3)
        article = Article.objects.create(title="خبر قديم", status=Article.Status.PUBLISHED, published_at=original)

        article.views = 10
        article.save()

        self.assertEqual(Article.objects.get(pk=article.pk).published_at, original)

    def test_editing_a_published_article_via_the_api_keeps_its_stamp(self):
        """The bug's actual shape: a PATCH that never mentions published_at
        at all must not blank out — or re-stamp — a date that's already
        there."""
        section = Section.objects.create(key="egypt", name_ar="شؤون مصر")
        original = timezone.now() - datetime.timedelta(hours=5)
        article = Article.objects.create(
            title="خبر", section=section, status=Article.Status.PUBLISHED, published_at=original
        )
        client = APIClient()
        client.force_authenticate(User.objects.create_user(username="editor", password="pw", is_staff=True))

        res = client.patch(f"/api/articles/{article.slug}/", {"title": "خبر معدّل"}, format="json")

        self.assertEqual(res.status_code, 200, res.data)
        article.refresh_from_db()
        self.assertEqual(article.published_at, original)


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


class ArticleViewTrackingTests(APITestCase):
    """
    POST /api/articles/<slug>/track-view/.

    regression: nothing in the codebase ever incremented Article.views. Every
    non-zero value in that column came from seed_demo_data, so «الأكثر قراءة»
    was a frozen list of three-week-old demo rows and a story sent real
    traffic could never enter it — reported live as "I drove traffic to a new
    article and it never appears in Most Read".
    """

    def setUp(self):
        self.article = Article.objects.create(
            title="خبر منشور", status=Article.Status.PUBLISHED, published_at=timezone.now()
        )

    def test_a_reader_increments_the_counter(self):
        res = self.client.post(f"/api/articles/{self.article.slug}/track-view/")

        self.assertEqual(res.status_code, 204)
        self.article.refresh_from_db()
        self.assertEqual(self.article.views, 1)

    def test_each_hit_counts(self):
        for _ in range(3):
            self.client.post(f"/api/articles/{self.article.slug}/track-view/")

        self.article.refresh_from_db()
        self.assertEqual(self.article.views, 3)

    def test_tracking_by_id_works_too(self):
        """SlugOrPkLookupMixin: the beacon may hold either."""
        res = self.client.post(f"/api/articles/{self.article.pk}/track-view/")

        self.assertEqual(res.status_code, 204)
        self.article.refresh_from_db()
        self.assertEqual(self.article.views, 1)

    def test_a_read_is_not_an_edit(self):
        """The counter must not bump updated_at — an article's «آخر تعديل» in
        the dashboard would otherwise change every time a reader opened it,
        and Article.save() would re-run on every page view."""
        before = Article.objects.get(pk=self.article.pk).updated_at

        self.client.post(f"/api/articles/{self.article.slug}/track-view/")

        self.assertEqual(Article.objects.get(pk=self.article.pk).updated_at, before)

    def test_an_unpublished_article_cannot_be_farmed(self):
        draft = Article.objects.create(title="مسودة", status=Article.Status.DRAFT)

        res = self.client.post(f"/api/articles/{draft.slug}/track-view/")

        self.assertEqual(res.status_code, 404)
        draft.refresh_from_db()
        self.assertEqual(draft.views, 0)

    def test_a_missing_article_is_a_404_not_a_500(self):
        res = self.client.post("/api/articles/لا-يوجد/track-view/")

        self.assertEqual(res.status_code, 404)


class MostReadQueryTests(APITestCase):
    """`?ordering=-views` — what «الأكثر قراءة» actually asks for."""

    def setUp(self):
        now = timezone.now()
        self.old_hit = Article.objects.create(
            title="خبر قديم مقروء", status=Article.Status.PUBLISHED, views=30000,
            published_at=now - datetime.timedelta(days=21),
        )
        self.fresh_hit = Article.objects.create(
            title="خبر جديد مقروء", status=Article.Status.PUBLISHED, views=400, published_at=now,
        )
        self.fresh_quiet = Article.objects.create(
            title="خبر جديد هادئ", status=Article.Status.PUBLISHED, views=5, published_at=now,
        )

    def test_sorts_by_views_descending(self):
        res = self.client.get("/api/articles/?ordering=-views")

        titles = [a["title"] for a in res.json()["results"]]
        self.assertEqual(titles[0], "خبر قديم مقروء")

    def test_page_size_limits_the_list(self):
        res = self.client.get("/api/articles/?ordering=-views&page_size=2")

        self.assertEqual(len(res.json()["results"]), 2)

    def test_a_busier_older_story_outranks_a_quieter_newer_one(self):
        """The client's report — «الترتيب الزمني مختلط». It is supposed to be:
        «الأكثر قراءة» ranks by popularity, so a story published five hours ago
        with more reads sits above one published an hour ago with fewer. This
        pins that as intended behaviour rather than a regression waiting to be
        "fixed" back into a chronological list."""
        now = timezone.now()
        Article.objects.create(
            title="الأقدم والأكثر قراءة", status=Article.Status.PUBLISHED, views=9,
            published_at=now - datetime.timedelta(hours=5),
        )
        Article.objects.create(
            title="الأحدث والأقل قراءة", status=Article.Status.PUBLISHED, views=8,
            published_at=now - datetime.timedelta(hours=1),
        )

        res = self.client.get("/api/articles/?ordering=-views&published_within=7")
        titles = [a["title"] for a in res.json()["results"]]

        self.assertLess(titles.index("الأقدم والأكثر قراءة"), titles.index("الأحدث والأقل قراءة"))

    def test_the_recency_window_lets_a_new_story_reach_the_top(self):
        """The client's actual complaint: a three-week-old demo row with
        30,000 seeded views cannot be displaced on an all-time ranking, so
        the list scopes to what was published recently."""
        res = self.client.get("/api/articles/?ordering=-views&published_within=7")

        titles = [a["title"] for a in res.json()["results"]]
        self.assertEqual(titles, ["خبر جديد مقروء", "خبر جديد هادئ"])
        self.assertNotIn("خبر قديم مقروء", titles)

    def test_a_zero_or_negative_window_means_no_window(self):
        for value in ("0", "-3"):
            res = self.client.get(f"/api/articles/?ordering=-views&published_within={value}")

            self.assertEqual(len(res.json()["results"]), 3, value)

    def test_a_non_numeric_window_is_rejected_rather_than_ignored(self):
        """NumberFilter answers junk with a 400 naming the field, which is a
        better failure than silently serving an unfiltered list that looks
        correct."""
        res = self.client.get("/api/articles/?ordering=-views&published_within=abc")

        self.assertEqual(res.status_code, 400)
        self.assertIn("published_within", res.json())

    def test_tied_view_counts_break_by_recency_not_at_random(self):
        """regression: `?ordering=-views` alone leaves every 0-view article
        tied, and the database may return tied rows in any order — so the
        list reshuffled between renders and pagination could repeat or skip
        a row. Newest-first is the tie-break a reader expects."""
        now = timezone.now()
        older = Article.objects.create(
            title="متعادل أقدم", status=Article.Status.PUBLISHED, views=0,
            published_at=now - datetime.timedelta(hours=5),
        )
        newer = Article.objects.create(
            title="متعادل أحدث", status=Article.Status.PUBLISHED, views=0, published_at=now,
        )

        titles = [a["title"] for a in self.client.get("/api/articles/?ordering=-views").json()["results"]]

        self.assertLess(titles.index(newer.title), titles.index(older.title))

    def test_pagination_stays_stable_across_pages_when_everything_ties(self):
        for i in range(12):
            Article.objects.create(
                title=f"صفر {i}", status=Article.Status.PUBLISHED, views=0,
                published_at=timezone.now() - datetime.timedelta(minutes=i),
            )

        page1 = self.client.get("/api/articles/?ordering=-views&page_size=5").json()["results"]
        page2 = self.client.get("/api/articles/?ordering=-views&page_size=5&page=2").json()["results"]

        ids1 = [a["id"] for a in page1]
        ids2 = [a["id"] for a in page2]
        self.assertEqual(len(set(ids1) & set(ids2)), 0)


class MostCommentedQueryTests(APITestCase):
    """
    «الأكثر تعليقاً» — the second tab of the home page's news box.

    The newsroom reported this tab as showing the latest news, i.e. as being
    wired to the «الأحدث» tab's query. It never was. `?ordering=-comment_count`
    over a site where nearly every story has zero comments produces a sort key
    that everything ties on, and StableOrderingFilter breaks that tie on
    `-published_at` — so the tab returned the newest stories and looked like a
    copy of the tab beside it. These tests pin the actual fix: the pool is
    filtered to stories that have an approved comment.
    """

    def setUp(self):
        now = timezone.now()
        self.busy = Article.objects.create(
            title="خبر عليه نقاش", status=Article.Status.PUBLISHED,
            published_at=now - datetime.timedelta(days=2),
        )
        self.quiet_but_newer = Article.objects.create(
            title="خبر جديد بلا تعليقات", status=Article.Status.PUBLISHED, published_at=now,
        )
        for i in range(3):
            Comment.objects.create(
                article=self.busy, user_name=f"قارئ {i}", text="تعليق",
                status=Comment.Status.APPROVED,
            )

    def test_has_comments_drops_the_silent_stories(self):
        res = self.client.get("/api/articles/?ordering=-comment_count&has_comments=true")

        titles = [a["title"] for a in res.json()["results"]]
        self.assertEqual(titles, ["خبر عليه نقاش"])

    def test_without_the_filter_the_newest_story_ties_its_way_to_the_top(self):
        """The exact behaviour the newsroom saw — kept as a test so nobody
        'fixes' the ordering that was never broken."""
        res = self.client.get("/api/articles/?ordering=-comment_count")

        titles = [a["title"] for a in res.json()["results"]]
        self.assertEqual(titles[0], "خبر عليه نقاش")
        self.assertIn("خبر جديد بلا تعليقات", titles)

    def test_has_comments_false_returns_the_complement(self):
        res = self.client.get("/api/articles/?has_comments=false")

        titles = [a["title"] for a in res.json()["results"]]
        self.assertEqual(titles, ["خبر جديد بلا تعليقات"])

    def test_pending_comments_do_not_count(self):
        """
        A story whose only comments sit unapproved in the moderation queue
        advertises a discussion no reader can open — and, with the pool now
        filtered on this count, it would have LED the tab.
        """
        spammed = Article.objects.create(
            title="خبر عليه سبام", status=Article.Status.PUBLISHED, published_at=timezone.now(),
        )
        for i in range(9):
            Comment.objects.create(article=spammed, user_name=f"س{i}", text="سبام")

        res = self.client.get("/api/articles/?ordering=-comment_count&has_comments=true")

        titles = [a["title"] for a in res.json()["results"]]
        self.assertNotIn("خبر عليه سبام", titles)
        self.assertEqual(titles, ["خبر عليه نقاش"])

    def test_banned_comments_do_not_count(self):
        Comment.objects.create(
            article=self.quiet_but_newer, user_name="محظور", text="مسيء",
            status=Comment.Status.BANNED,
        )

        res = self.client.get("/api/articles/?has_comments=true")

        titles = [a["title"] for a in res.json()["results"]]
        self.assertNotIn("خبر جديد بلا تعليقات", titles)

    def test_card_count_reports_approved_only(self):
        Comment.objects.create(article=self.busy, user_name="معلّق", text="بانتظار المراجعة")

        res = self.client.get("/api/articles/?has_comments=true")

        card = next(a for a in res.json()["results"] if a["title"] == "خبر عليه نقاش")
        self.assertEqual(card["comment_count"], 3)


class TrendingScoreOrderingTests(APITestCase):
    """
    `?ordering=-trending_score` — the client's follow-up: «الأكثر قراءة»
    should favour what's being read *now*, not just whichever story has
    piled up the most reads since it went live. `MostReadQueryTests` above
    pins `-views` (still available, unchanged) on exactly the opposite
    expectation — a busier older story outranking a quieter newer one is
    correct THERE precisely because that ordering carries no notion of
    recency at all. `-trending_score` is the ordering that does.
    """

    def test_a_fresh_spike_outranks_a_slower_older_accumulator(self):
        """The client's actual scenario: a story from days ago that has
        merely kept accumulating reads must not out-rank one from the last
        hour that is clearly being read *right now*, even though the older
        story's raw total is higher."""
        now = timezone.now()
        Article.objects.create(
            title="تراكم قديم بلا زخم", status=Article.Status.PUBLISHED, views=48,
            published_at=now - datetime.timedelta(hours=48),  # 1 view/hour, lifetime
        )
        Article.objects.create(
            title="زخم جديد الآن", status=Article.Status.PUBLISHED, views=20,
            published_at=now - datetime.timedelta(hours=2),  # 10 views/hour, right now
        )

        res = self.client.get("/api/articles/?ordering=-trending_score")
        titles = [a["title"] for a in res.json()["results"]]

        self.assertEqual(titles[:2], ["زخم جديد الآن", "تراكم قديم بلا زخم"])

    def test_a_just_published_story_does_not_divide_by_near_zero(self):
        """A story published moments ago must not rocket to the top on a
        single read purely because the denominator (hours since publish) is
        close to zero — the divisor is floored at one hour."""
        now = timezone.now()
        Article.objects.create(
            title="نُشر للتو بقراءة واحدة", status=Article.Status.PUBLISHED, views=1,
            published_at=now - datetime.timedelta(seconds=5),
        )
        steady = Article.objects.create(
            title="نصف ساعة وعشر قراءات", status=Article.Status.PUBLISHED, views=10,
            published_at=now - datetime.timedelta(minutes=30),
        )

        res = self.client.get("/api/articles/?ordering=-trending_score")
        titles = [a["title"] for a in res.json()["results"]]

        self.assertEqual(titles[0], steady.title)

    def test_a_draft_with_no_published_at_does_not_break_the_ordering(self):
        """Only a staff-authenticated caller can even see a draft (see
        ArticleViewSet.get_queryset), but `trending_score` is now a globally
        orderable field — a NULL published_at must score the row rather
        than poisoning the whole ordered list with a NULL."""
        from content.views import ArticleViewSet

        draft = Article.objects.create(title="مسودة بلا تاريخ نشر", status=Article.Status.DRAFT, views=3)

        qs = Article.objects.filter(pk=draft.pk).annotate(**ArticleViewSet._trending_annotations())
        row = qs.get()

        self.assertEqual(row.hours_since_published, 0.0)
        self.assertEqual(row.trending_score, 3.0)


class ArticleCardExcerptTests(APITestCase):
    """
    `excerpt` on the card shape — what the RSS feed prints as an item's
    <description> for Google News (see frontend/lib/rss.ts). The feed only
    ever sees card rows, so a story with no standfirst has to be summarised
    from its body here or not at all.
    """

    def _card(self, article):
        res = self.client.get("/api/articles/?status=published")
        return next(r for r in res.data["results"] if r["id"] == article.id)

    def test_prefers_the_desk_written_standfirst(self):
        article = Article.objects.create(
            title="خبر", standfirst="المقدمة التي كتبها المحرر",
            status=Article.Status.PUBLISHED, published_at=timezone.now(),
        )
        ArticleBlock.objects.create(article=article, order=0, type=ArticleBlock.Type.PARAGRAPH, text="أول فقرة")

        self.assertEqual(self._card(article)["excerpt"], "المقدمة التي كتبها المحرر")

    def test_falls_back_to_the_first_paragraph(self):
        """regression: most stories here are filed with no standfirst, so the
        feed's description was the section name — «عرب وعالم» and nothing
        more — for every one of them."""
        article = Article.objects.create(title="خبر", status=Article.Status.PUBLISHED, published_at=timezone.now())
        ArticleBlock.objects.create(article=article, order=0, type=ArticleBlock.Type.HEADING, text="عنوان فرعي")
        ArticleBlock.objects.create(article=article, order=1, type=ArticleBlock.Type.PARAGRAPH, text="نص الفقرة الأولى")

        self.assertEqual(self._card(article)["excerpt"], "نص الفقرة الأولى")

    def test_skips_an_empty_paragraph_block(self):
        article = Article.objects.create(title="خبر", status=Article.Status.PUBLISHED, published_at=timezone.now())
        ArticleBlock.objects.create(article=article, order=0, type=ArticleBlock.Type.PARAGRAPH, text="   ")
        ArticleBlock.objects.create(article=article, order=1, type=ArticleBlock.Type.PARAGRAPH, text="النص الحقيقي")

        self.assertEqual(self._card(article)["excerpt"], "النص الحقيقي")

    def test_is_empty_for_a_story_with_no_prose(self):
        article = Article.objects.create(title="خبر", status=Article.Status.PUBLISHED, published_at=timezone.now())

        self.assertEqual(self._card(article)["excerpt"], "")

    def test_collapses_whitespace_and_caps_length(self):
        article = Article.objects.create(title="خبر", status=Article.Status.PUBLISHED, published_at=timezone.now())
        ArticleBlock.objects.create(
            article=article, order=0, type=ArticleBlock.Type.PARAGRAPH, text="أ\n\n  ب " + "ج" * 900,
        )

        excerpt = self._card(article)["excerpt"]
        self.assertEqual(len(excerpt), 600)
        self.assertTrue(excerpt.startswith("أ ب ج"))

    def test_listing_cards_costs_no_query_per_card(self):
        """The blocks are prefetched, so adding a card must not add a query —
        the home page asks for a hundred of them at a time."""
        for i in range(3):
            article = Article.objects.create(
                title=f"خبر {i}", status=Article.Status.PUBLISHED, published_at=timezone.now(),
            )
            ArticleBlock.objects.create(article=article, order=0, type=ArticleBlock.Type.PARAGRAPH, text=f"فقرة {i}")

        # count + page + the tags prefetch + the blocks prefetch: four
        # regardless of how many cards come back, which is the point.
        with self.assertNumQueries(4):
            res = self.client.get("/api/articles/?status=published&page_size=3")
        self.assertEqual([r["excerpt"] for r in res.data["results"]], ["فقرة 2", "فقرة 1", "فقرة 0"])


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
        # APPROVED explicitly: the count is the public tally, so a comment
        # still in the moderation queue is deliberately not in it — see
        # content.views.APPROVED_COMMENTS.
        Comment.objects.create(
            article=self.published, user_name="سارة", text="تعليق", status=Comment.Status.APPROVED
        )
        Comment.objects.create(
            article=self.published, user_name="عمر", text="تعليق آخر", status=Comment.Status.APPROVED
        )

        res = self.client.get("/api/articles/?ordering=-comment_count")

        self.assertEqual(res.json()["results"][0]["comment_count"], 2)

    def test_pinned_leads_a_section_listing_even_when_older(self):
        """«تثبيت في الرئيسية» leads the home hero already; the client also
        wants it to lead its own section page, which reads this same
        ?ordering=-pinned,-published_at the section pages now pass."""
        Article.objects.create(
            title="أحدث خبر", slug="newer-unpinned", section=self.section,
            status=Article.Status.PUBLISHED, published_at=timezone.now(),
        )
        self.published.pinned = True
        self.published.save(update_fields=["pinned"])

        res = self.client.get(f"/api/articles/?section__key={self.section.key}&ordering=-pinned,-published_at")

        self.assertEqual(res.json()["results"][0]["slug"], "published-one")

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

    def test_tag_whose_slug_already_exists_under_another_name_is_reused(self):
        """regression — the newsroom's "publishing is broken" bug.

        `_sync_tags` looked tags up by `name` only, while `slug` carries a
        unique constraint of its own and slugify() drops the punctuation that
        distinguishes two names. Production held Tag(name="#عاجل",
        slug="عاجل"), so tagging a story «عاجل» matched nothing by name and
        the INSERT that followed violated content_tag_slug_key — a 500 on
        every save that used the newsroom's most common tags.
        """
        existing = Tag.objects.create(name="#عاجل", slug="عاجل")

        res = self.client.post(
            "/api/articles/",
            {
                "title": "خبر عاجل من القاهرة",
                "status": "published",
                "section": self.section.pk,
                "blocks": [{"order": 0, "type": "paragraph", "text": "نص الخبر"}],
                "tag_names": ["عاجل"],
            },
            format="json",
        )

        self.assertEqual(res.status_code, 201, res.data)
        article = Article.objects.get(pk=res.json()["id"])
        self.assertEqual(list(article.tags.all()), [existing])
        self.assertEqual(Tag.objects.filter(slug="عاجل").count(), 1)
        # The body is what actually went missing for the client — the tag
        # blew up before _sync_blocks ever ran.
        self.assertEqual(article.blocks.count(), 1)

    def test_two_tags_colliding_on_one_slug_in_a_single_payload(self):
        """«عاجل» and «#عاجل» in the same save slugify identically — the
        second used to collide with the row the first had just created."""
        res = self.client.post(
            "/api/articles/",
            {"title": "خبر", "tag_names": ["عاجل", "#عاجل", "  ", "عاجل"]},
            format="json",
        )

        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(Tag.objects.filter(slug="عاجل").count(), 1)
        self.assertEqual(Article.objects.get(pk=res.json()["id"]).tags.count(), 1)

    def test_exact_name_match_wins_over_a_slug_match(self):
        """Two rows can legitimately share a slug stem. The tag the editor
        typed is the one they meant, so an exact name match decides first."""
        Tag.objects.create(name="عاجل", slug="عاجل")
        hashed = Tag.objects.create(name="#عاجل", slug="عاجل-2")

        res = self.client.post("/api/articles/", {"title": "خبر", "tag_names": ["#عاجل"]}, format="json")

        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(list(Article.objects.get(pk=res.json()["id"]).tags.all()), [hashed])

    def test_failed_save_leaves_no_ghost_article(self):
        """The save is one editorial act: if any part of it fails, nothing is
        written. The client's ghost articles — title, section, cover and flags
        saved, body empty, un-editable afterwards — were the fallout of five
        separately committed steps."""
        before = Article.objects.count()

        with mock.patch.object(
            ArticleWriteSerializer, "_sync_tags", side_effect=IntegrityError("boom")
        ):
            res = self.client.post(
                "/api/articles/",
                {
                    "title": "خبر لن يُحفظ",
                    "status": "published",
                    "section": self.section.pk,
                    "blocks": [{"order": 0, "type": "paragraph", "text": "نص"}],
                    "tag_names": ["وسم"],
                },
                format="json",
            )

        self.assertEqual(res.status_code, 409)
        self.assertEqual(Article.objects.count(), before)
        self.assertFalse(Article.objects.filter(title="خبر لن يُحفظ").exists())

    def test_constraint_failure_reports_a_readable_error(self):
        """A 500 rendered as a bare "A server error occurred.", which the
        editor's describeApiError() cannot read — so every failure surfaced as
        the generic "تعذّر حفظ الخبر" with no clue what to fix."""
        with mock.patch.object(
            ArticleWriteSerializer, "_sync_tags", side_effect=IntegrityError("duplicate key value violates ...")
        ):
            res = self.client.post("/api/articles/", {"title": "خبر", "tag_names": ["وسم"]}, format="json")

        self.assertEqual(res.status_code, 409)
        self.assertIn("detail", res.data)
        self.assertTrue(res.data["detail"].strip())
        # Staff get the driver's own message; see aldaftar/exceptions.py.
        self.assertIn("duplicate key", res.data["db_detail"])

    def test_standfirst_of_a_single_dot_is_accepted(self):
        """The client files stories with «.» as the standfirst. There is no
        minimum-length rule on the field and there must not be one — this
        pins that, since it was a suspect in the failed-save report."""
        res = self.client.post(
            "/api/articles/",
            {
                "title": "خبر بمقدمة نقطة",
                "status": "published",
                "standfirst": ".",
                "section": self.section.pk,
                "pinned": True,
                "push_story": True,
                "subcategory": "سياسة",
                "country": "الكويت",
                "blocks": [{"order": 0, "type": "paragraph", "text": "نص الخبر"}],
            },
            format="json",
        )

        self.assertEqual(res.status_code, 201, res.data)
        article = Article.objects.get(pk=res.json()["id"])
        self.assertEqual(article.standfirst, ".")
        self.assertTrue(article.pinned)
        self.assertEqual(article.blocks.count(), 1)

    def test_overlong_tag_name_is_a_400_not_a_500(self):
        """Tag.name is varchar(60). Unvalidated, an over-long tag reached
        Postgres and failed mid-save; now it is a field error before anything
        is written."""
        res = self.client.post("/api/articles/", {"title": "خبر", "tag_names": ["ط" * 200]}, format="json")

        self.assertEqual(res.status_code, 400)
        self.assertIn("tag_names", res.data)

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

    def test_block_align_round_trips(self):
        """The editor's alignment menu — a plain choice field per block,
        passed straight through _sync_blocks like any other block field."""
        res = self.client.post(
            "/api/articles/",
            {
                "title": "مقال بفقرة مضبوطة",
                "blocks": [{"order": 0, "type": "paragraph", "text": "فقرة", "align": "justify"}],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)

        article = Article.objects.get(pk=res.json()["id"])
        self.assertEqual(article.blocks.first().align, "justify")

    def test_block_align_defaults_to_justify(self):
        """Unset in the payload, a new block still gets an explicit value —
        justified, so its line lengths read as typeset rather than random."""
        res = self.client.post(
            "/api/articles/",
            {"title": "مقال بلا محاذاة محددة", "blocks": [{"order": 0, "type": "paragraph", "text": "فقرة"}]},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)

        article = Article.objects.get(pk=res.json()["id"])
        self.assertEqual(article.blocks.first().align, "justify")

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

    def test_push_story_routes_an_english_article_to_its_own_edition(self):
        """regression: _push_surfaces always built href as bare
        /article/<slug>, regardless of the article's own language. /article/
        doesn't gate on language (only kind/status), so an English push
        rendered under Arabic RTL chrome with an English headline stapled
        onto it instead of 404ing — the mixed-chrome bug this codebase
        elsewhere goes out of its way to avoid."""
        res = self.client.post(
            "/api/articles/",
            {
                "title": "Cabinet approves new incentives",
                "status": "published",
                "language": "en",
                "section": self.section.pk,
                "push_story": True,
                "blocks": [{"order": 0, "type": "paragraph", "text": "Body text."}],
            },
            format="json",
        )

        self.assertEqual(res.status_code, 201, res.data)
        article = Article.objects.get(pk=res.json()["id"])
        story = Story.objects.get(title=article.title)
        self.assertEqual(story.href, f"/en/article/{article.slug}")

    def test_push_story_accepts_a_headline_longer_than_120_characters(self):
        """regression: Story.title was capped at 120 while Article.title
        allows 280, and _push_surfaces copies the headline verbatim — so
        publishing a long headline with «تثبيت في شريط القصص» ticked blew up
        in Postgres ("value too long for type character varying(120)"), the
        whole save rolled back, and the editor got a generic DB-conflict
        error pointing them at tags and the slug instead."""
        title = "مفاجأة في لقاء السيسي مع الرئيس الصيني: " + "صفقة ذكاء اصطناعي بين مصر والصين تثير الجدل " * 4
        title = title.strip()
        self.assertGreater(len(title), 120)
        self.assertLessEqual(len(title), 280)

        res = self.client.post(
            "/api/articles/",
            {
                "title": title,
                "status": "published",
                "section": self.section.pk,
                "push_story": True,
                "push_breaking": True,
                "blocks": [{"order": 0, "type": "paragraph", "text": "Body text."}],
            },
            format="json",
        )

        self.assertEqual(res.status_code, 201, res.data)
        article = Article.objects.get(pk=res.json()["id"])
        self.assertEqual(Story.objects.get(href=f"/article/{article.slug}").title, title)
        self.assertEqual(BreakingNewsItem.objects.get(href=f"/article/{article.slug}").text, title)

    def test_push_breaking_routes_an_english_article_to_its_own_edition(self):
        """Same bug, same fix, the other one-click surface."""
        res = self.client.post(
            "/api/articles/",
            {
                "title": "Central bank holds rates",
                "status": "published",
                "language": "en",
                "section": self.section.pk,
                "push_breaking": True,
                "blocks": [{"order": 0, "type": "paragraph", "text": "Body text."}],
            },
            format="json",
        )

        self.assertEqual(res.status_code, 201, res.data)
        article = Article.objects.get(pk=res.json()["id"])
        item = BreakingNewsItem.objects.get(text=article.title)
        self.assertEqual(item.href, f"/en/article/{article.slug}")

    def test_push_story_routes_an_opinion_piece_to_the_one_opinion_route(self):
        """Opinion pieces have a single route in both editions — no
        /en/opinion/ exists (see lib/rss.ts's own articleUrl on the frontend
        for why) — so this must stay /opinion/<slug> regardless of language,
        never falling into the /en/article/ branch an English opinion piece
        would otherwise match."""
        res = self.client.post(
            "/api/articles/",
            {
                "title": "الاقتصاد وتحديات المرحلة",
                "kind": "opinion",
                "status": "published",
                "language": "ar",
                "section": self.section.pk,
                "push_story": True,
                "blocks": [{"order": 0, "type": "paragraph", "text": "نص المقال."}],
            },
            format="json",
        )

        self.assertEqual(res.status_code, 201, res.data)
        article = Article.objects.get(pk=res.json()["id"])
        story = Story.objects.get(title=article.title)
        self.assertEqual(story.href, f"/opinion/{article.slug}")

    def test_push_story_keeps_a_plain_arabic_news_article_unchanged(self):
        """Pins the existing, already-correct behaviour so the language/kind
        branches above can't quietly break the default case."""
        res = self.client.post(
            "/api/articles/",
            {
                "title": "خبر عربي عادي",
                "status": "published",
                "language": "ar",
                "section": self.section.pk,
                "push_story": True,
                "blocks": [{"order": 0, "type": "paragraph", "text": "نص الخبر."}],
            },
            format="json",
        )

        self.assertEqual(res.status_code, 201, res.data)
        article = Article.objects.get(pk=res.json()["id"])
        story = Story.objects.get(title=article.title)
        self.assertEqual(story.href, f"/article/{article.slug}")


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

    def test_related_block_exposes_target_kind(self):
        """An «اقرأ أيضاً» box pointing at an opinion piece must let the
        frontend route to /opinion/[slug] instead of /article/[slug] — the
        latter 404s any article whose kind isn't "news" (see
        app/article/[slug]/page.tsx's generateMetadata). Without this field
        the client can't tell the two apart and always links to /article/."""
        target = Article.objects.create(title="عمود رأي", slug="opinion-target", kind=Article.Kind.OPINION)
        article = Article.objects.create(title="مقال", slug="host-article-2")
        ArticleBlock.objects.create(article=article, order=0, type="related", text=target.title, related_article=target)

        from content.serializers import ArticleBlockSerializer

        data = ArticleBlockSerializer(article.blocks.first()).data
        self.assertEqual(data["related_article_kind"], "opinion")

    def test_related_block_kind_is_none_without_a_target(self):
        article = Article.objects.create(title="مقال", slug="host-article-3")
        ArticleBlock.objects.create(article=article, order=0, type="paragraph", text="نص")

        from content.serializers import ArticleBlockSerializer

        data = ArticleBlockSerializer(article.blocks.first()).data
        self.assertIsNone(data["related_article_kind"])


class CommentAPITests(APITestCase):
    def setUp(self):
        self.article = Article.objects.create(title="مقال", slug="c1", status=Article.Status.PUBLISHED)
        # PublicSubmission allows anonymous POST only — moderation queue
        # reads/edits are staff work.
        self.staff = User.objects.create(username="mod-staff", is_staff=True, role="moderator")
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
        self.client.force_authenticate(User.objects.create(username="breaking-staff", is_staff=True, role="editor"))

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

    def test_orders_newest_first_when_asked(self):
        """
        regression: `ordering_fields` listed only "order", and DRF's
        OrderingFilter silently DROPS a term that isn't in that list — it
        falls back to Meta.ordering and returns 200, so the rail's
        `?ordering=-created_at` looked applied and wasn't. The rail is
        newest-first, so this has to actually take effect.
        """
        older = Story.objects.create(title="أقدم", active=True, order=0)
        newer = Story.objects.create(title="أحدث", active=True, order=99)
        Story.objects.filter(pk=older.pk).update(created_at=timezone.now() - datetime.timedelta(days=2))
        Story.objects.filter(pk=newer.pk).update(created_at=timezone.now())

        res = self.client.get("/api/stories/?active=true&ordering=-created_at")

        titles = [s["title"] for s in res.json()["results"]]
        # Newest first despite `newer` carrying the higher `order` value,
        # which is what the default sort would have led with.
        self.assertLess(titles.index("أحدث"), titles.index("أقدم"))

    def test_page_size_caps_the_rail(self):
        for i in range(20):
            Story.objects.create(title=f"قصة {i}", active=True)

        res = self.client.get("/api/stories/?active=true&page_size=13")

        self.assertEqual(len(res.json()["results"]), 13)

    def test_create_and_reorder(self):
        self.client.force_authenticate(User.objects.create(username="stories-staff", is_staff=True, role="editor"))

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
