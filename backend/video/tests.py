"""Tests for the لقطة وتعليق video section and its comment thread."""
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase

from content.models import Section
from video.models import Reel, Video, VideoComment

User = get_user_model()


class VideoModelTests(TestCase):
    def test_duration_label_is_mm_ss_zero_padded(self):
        self.assertEqual(Video.objects.create(title="v", slug="v1", duration_seconds=192).duration_label, "03:12")
        self.assertEqual(Video.objects.create(title="v", slug="v2", duration_seconds=344).duration_label, "05:44")
        self.assertEqual(Video.objects.create(title="v", slug="v3", duration_seconds=5).duration_label, "00:05")

    def test_duration_label_handles_over_an_hour(self):
        video = Video.objects.create(title="v", slug="v4", duration_seconds=3725)

        self.assertEqual(video.duration_label, "62:05")

    def test_live_video_has_no_duration_label(self):
        """A live stream has no fixed length — the badge shows an em dash."""
        video = Video.objects.create(title="بث", slug="live-v", is_live=True, duration_seconds=0)

        self.assertEqual(video.duration_label, "—")

    def test_zero_duration_shows_dash(self):
        video = Video.objects.create(title="v", slug="v5", duration_seconds=0)

        self.assertEqual(video.duration_label, "—")


class VideoCommentTests(TestCase):
    def test_initial_is_derived_from_name(self):
        video = Video.objects.create(title="v", slug="vc1")
        comment = VideoComment.objects.create(video=video, name="سارة أحمد", text="تعليق")

        self.assertEqual(comment.initial, "س")

    def test_explicit_initial_is_respected(self):
        video = Video.objects.create(title="v", slug="vc2")
        comment = VideoComment.objects.create(video=video, name="سارة", initial="X", text="تعليق")

        self.assertEqual(comment.initial, "X")

    def test_comments_are_newest_first(self):
        video = Video.objects.create(title="v", slug="vc3")
        VideoComment.objects.create(video=video, name="أول", text="1")
        VideoComment.objects.create(video=video, name="ثان", text="2")

        self.assertEqual(video.comments.first().name, "ثان")


class VideoAPITests(APITestCase):
    def setUp(self):
        self.section = Section.objects.create(key="economy", name_ar="اقتصاد")
        self.video = Video.objects.create(
            title="جولة داخل مصنع", slug="factory-tour", section=self.section,
            duration_seconds=440, views=12480, is_exclusive=True,
        )

    def test_list_includes_computed_fields(self):
        VideoComment.objects.create(video=self.video, name="أ", text="1")

        res = self.client.get("/api/videos/")
        row = res.json()["results"][0]

        self.assertEqual(row["duration_label"], "07:20")
        self.assertEqual(row["comment_count"], 1)
        self.assertEqual(row["section_name"], "اقتصاد")

    def test_detail_by_slug_embeds_comments(self):
        VideoComment.objects.create(video=self.video, name="سارة", text="تعليق", status=VideoComment.Status.APPROVED)

        res = self.client.get("/api/videos/factory-tour/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()["comments"]), 1)

    def test_pending_comments_are_hidden_from_the_public_detail(self):
        """regression: VideoComment had no moderation/status field at all,
        so any anonymous POST to /api/video-comments/ was published on the
        video page instantly with no approval step, unlike article
        comments. A pending comment must not appear to an anonymous caller."""
        VideoComment.objects.create(video=self.video, name="مجهول", text="سبام", status=VideoComment.Status.PENDING)

        res = self.client.get("/api/videos/factory-tour/")

        self.assertEqual(res.json()["comments"], [])

    def test_staff_sees_pending_comments_on_the_detail_view(self):
        """Staff moderating the video page need to see the pending queue
        alongside what's already approved, not just the public view."""
        VideoComment.objects.create(video=self.video, name="مجهول", text="سبام", status=VideoComment.Status.PENDING)
        self.client.force_authenticate(User.objects.create(username="video-staff-4", is_staff=True, role="editor"))

        res = self.client.get("/api/videos/factory-tour/")

        self.assertEqual(len(res.json()["comments"]), 1)

    def test_detail_by_numeric_id(self):
        """regression: the videos dashboard PATCHes /videos/<id>/ while the
        viewset looks up by slug — the live/exclusive toggles 404'd silently."""
        res = self.client.get(f"/api/videos/{self.video.pk}/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["slug"], "factory-tour")

    def test_patch_toggle_by_numeric_id(self):
        self.client.force_authenticate(User.objects.create(username="video-staff-1", is_staff=True, role="editor"))

        res = self.client.patch(f"/api/videos/{self.video.pk}/", {"is_exclusive": False}, format="json")

        self.assertEqual(res.status_code, 200)
        self.video.refresh_from_db()
        self.assertFalse(self.video.is_exclusive)

    def test_patch_toggle_by_slug(self):
        self.client.force_authenticate(User.objects.create(username="video-staff-2", is_staff=True, role="editor"))

        res = self.client.patch("/api/videos/factory-tour/", {"is_live": True}, format="json")

        self.assertEqual(res.status_code, 200)
        self.video.refresh_from_db()
        self.assertTrue(self.video.is_live)

    def test_staff_can_set_the_view_count_shown_on_the_dashboard(self):
        """VideosManager's «👁» edit — an editorial override of the shown
        count, not a real-view tracker. Real views (if that's ever wired
        up) would only ever add on top of whatever's set here."""
        self.client.force_authenticate(User.objects.create(username="video-staff-5", is_staff=True, role="editor"))

        res = self.client.patch(f"/api/videos/{self.video.pk}/", {"views": 50000}, format="json")

        self.assertEqual(res.status_code, 200)
        self.video.refresh_from_db()
        self.assertEqual(self.video.views, 50000)

    def test_anonymous_reader_cannot_set_the_view_count(self):
        res = self.client.patch(f"/api/videos/{self.video.pk}/", {"views": 999999}, format="json")

        self.assertEqual(res.status_code, 403)
        self.video.refresh_from_db()
        self.assertEqual(self.video.views, 12480)

    def test_filter_by_section(self):
        Video.objects.create(title="آخر", slug="other-v")

        res = self.client.get("/api/videos/?section__key=economy")

        self.assertEqual(res.json()["count"], 1)

    def test_post_comment_derives_initial(self):
        res = self.client.post(
            "/api/video-comments/", {"video": self.video.pk, "name": "ندى محمود", "text": "تغطية ممتازة"}, format="json"
        )

        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()["initial"], "ن")

    def test_anonymous_post_is_pinned_to_pending(self):
        """regression: an anonymous submission used to be published on the
        video page the instant it was created — perform_create must force
        it to pending even if the client tries to send another status."""
        res = self.client.post(
            "/api/video-comments/",
            {"video": self.video.pk, "name": "زائر", "text": "تعليق", "status": VideoComment.Status.APPROVED},
            format="json",
        )

        self.assertEqual(res.status_code, 201)
        comment = VideoComment.objects.get(pk=res.json()["id"])
        self.assertEqual(comment.status, VideoComment.Status.PENDING)

    def test_staff_post_can_publish_directly(self):
        """A moderator adding a comment from the dashboard queue should be
        able to set the status explicitly rather than always landing pending."""
        self.client.force_authenticate(User.objects.create(username="video-staff-5", is_staff=True, role="editor"))

        res = self.client.post(
            "/api/video-comments/",
            {"video": self.video.pk, "name": "محرر", "text": "تعليق رسمي", "status": VideoComment.Status.APPROVED},
            format="json",
        )

        self.assertEqual(res.status_code, 201)
        comment = VideoComment.objects.get(pk=res.json()["id"])
        self.assertEqual(comment.status, VideoComment.Status.APPROVED)

    def test_comments_can_be_filtered_by_video(self):
        """PublicSubmission allows anonymous POST only — listing/filtering
        the comment thread (GET) is staff work, same as content.Comment."""
        other = Video.objects.create(title="آخر", slug="other-v2")
        VideoComment.objects.create(video=self.video, name="أ", text="1")
        VideoComment.objects.create(video=other, name="ب", text="2")
        self.client.force_authenticate(User.objects.create(username="video-staff-3", is_staff=True, role="editor"))

        res = self.client.get(f"/api/video-comments/?video={self.video.pk}")

        self.assertEqual(res.json()["count"], 1)


class ShortSlugBaseTests(TestCase):
    """
    `short_slug_base` — the word/character cap a reel's slug goes through
    that Article/Video's own slugs deliberately do not (see the constant's
    own comment in video/models.py). Verified against real scraped og:title
    text, not invented samples: these exact strings came off real reels this
    project scraped from Facebook.
    """

    def test_caps_at_six_words(self):
        from video.models import short_slug_base

        base = short_slug_base(
            "شاب يعمل في توصيل الطلبات يتعرض للتثبيت والاعتداء وسرقة هاتفه أثناء عمله"
        )

        self.assertEqual(base, "شاب-يعمل-في-توصيل-الطلبات-يتعرض")
        self.assertLessEqual(len(base.split("-")), 6)

    def test_caps_at_fifty_characters_even_under_six_words(self):
        from video.models import short_slug_base

        base = short_slug_base(
            "صرف مستشفى العامرية بالإسكندرية يغرق الشارع.. استغاثة من الأهالي"
        )

        self.assertLessEqual(len(base), 50)
        # The word that would have pushed it over 50 is dropped whole, not
        # cut mid-word.
        self.assertNotIn("استغا", base)

    def test_strips_emoji_and_punctuation_via_djangos_own_slugify(self):
        from video.models import short_slug_base

        base = short_slug_base("خبر عاجل ⚡ الرئيس يعلن ...")

        self.assertEqual(base, "خبر-عاجل-الرئيس-يعلن")
        self.assertNotIn("⚡", base)

    def test_never_leaves_a_trailing_dash(self):
        from video.models import short_slug_base

        base = short_slug_base("ترامب يقترح تغيير اسم مضيق هرمز إلى مضيق ترامب")

        self.assertFalse(base.startswith("-"))
        self.assertFalse(base.endswith("-"))

    def test_a_short_title_is_left_whole(self):
        from video.models import short_slug_base

        self.assertEqual(short_slug_base("عنوان قصير"), "عنوان-قصير")

    def test_falls_back_to_the_literal_when_nothing_survives_slugifying(self):
        from video.models import short_slug_base

        self.assertEqual(short_slug_base("🔥😱"), "reel")
        self.assertEqual(short_slug_base(""), "reel")


class ReelSlugTests(TestCase):
    """
    `Reel.assign_slug` — not wired into save() the way Video/Article auto-
    slug every row, because a reel's title is not known at its own first
    save (see the method's own docstring, and ReelSerializer._finalize).
    """

    def test_derives_a_slug_from_the_title(self):
        reel = Reel(title="عنوان الريل", facebook_url="https://facebook.com/reel/1")

        reel.assign_slug()

        self.assertEqual(reel.slug, "عنوان-الريل")

    def test_a_second_reel_with_the_same_title_gets_a_distinct_slug(self):
        first = Reel.objects.create(title="نفس العنوان", facebook_url="https://facebook.com/reel/1")
        # A freshly-created row holds its `reel-<pk>` placeholder (see
        # test_a_brand_new_row_gets_a_placeholder_slug_immediately) until
        # something finalizes it — done here explicitly so this test's
        # collision is against the REAL slug, matching what
        # ReelSerializer._finalize does moments after create() in practice.
        first.assign_slug()
        first.save(update_fields=["slug"])
        second = Reel(title="نفس العنوان", facebook_url="https://facebook.com/reel/2")

        second.assign_slug()

        self.assertEqual(second.slug, "نفس-العنوان-2")

    def test_falls_back_to_a_literal_when_the_title_yields_nothing_slugifiable(self):
        reel = Reel(title="!!!", facebook_url="https://facebook.com/reel/1")

        reel.assign_slug()

        self.assertEqual(reel.slug, "reel")

    def test_re_assigning_does_not_collide_with_its_own_previous_slug(self):
        """`.exclude(pk=self.pk)` — re-deriving a slug for a row that already
        holds one must not treat its own old value as a collision."""
        reel = Reel.objects.create(title="عنوان أول", facebook_url="https://facebook.com/reel/1")
        reel.title = "عنوان أول"

        reel.assign_slug()

        self.assertEqual(reel.slug, "عنوان-أول")

    def test_a_brand_new_row_gets_a_placeholder_slug_immediately(self):
        """
        Reel.save() — the case ReelSerializer's own multi-step create() flow
        depends on: a title is very often still blank at this exact moment
        (the scrape that fills it in happens a network round-trip later), so
        the row still needs SOME unique slug the instant it exists, or two
        reels created moments apart could both try to persist slug="" and
        collide on the unique constraint.
        """
        reel = Reel.objects.create(facebook_url="https://facebook.com/reel/1")

        self.assertEqual(reel.slug, f"reel-{reel.pk}")

    def test_an_already_titled_row_still_gets_the_placeholder_first(self):
        """
        Deliberately not smarter about this — Reel.save() does not check
        whether title happens to be known already; ReelSerializer._finalize
        is what replaces the placeholder with a real one right after,
        regardless of how the row got its title. See Reel.save()'s docstring.
        """
        reel = Reel.objects.create(title="عنوان معروف مسبقاً", facebook_url="https://facebook.com/reel/1")

        self.assertEqual(reel.slug, f"reel-{reel.pk}")

    def test_updating_an_existing_row_does_not_re_placeholder_its_slug(self):
        reel = Reel.objects.create(title="عنوان", facebook_url="https://facebook.com/reel/1")
        reel.assign_slug()
        reel.save(update_fields=["slug"])
        real_slug = reel.slug

        reel.order = 5
        reel.save()

        self.assertEqual(reel.slug, real_slug)


class ReelApiTests(APITestCase):
    """
    «بالمختصر» — the Facebook shorts shelf on the home page.

    Permissions, ordering and validation — not the scrape itself, which is
    OgImageExtractionTests/OgTitleExtractionTests/ReelMetadataFetchTests' job.
    `attach_scraped_metadata` is patched out for the whole class so a create()
    here never fires a real request at facebook.com; ordinary Django test runs
    have no network access at all, so an unpatched create would simply hang
    until it timed out rather than fail fast.
    """

    def setUp(self):
        self.editor = User.objects.create_user(
            username="reel-editor", password="pw", is_staff=True, role="editor"
        )
        self.writer = User.objects.create_user(
            username="reel-writer", password="pw", is_staff=True, role="author"
        )
        patcher = mock.patch("video.serializers.attach_scraped_metadata", return_value=(False, False))
        self.attach_scraped_metadata = patcher.start()
        self.addCleanup(patcher.stop)

    def test_list_is_public(self):
        """The home page renders this shelf with no session at all."""
        Reel.objects.create(title="ريل", facebook_url="https://facebook.com/reel/1")

        response = self.client.get("/api/reels/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)

    def test_ordering_is_order_then_newest(self):
        """`order` pins a reel to the head of the rail; the rest run newest-first."""
        Reel.objects.create(title="أول", facebook_url="https://facebook.com/reel/a", order=1)
        Reel.objects.create(title="ثاني", facebook_url="https://facebook.com/reel/b", order=1)
        Reel.objects.create(title="مثبّت", facebook_url="https://facebook.com/reel/c", order=0)

        titles = [r["title"] for r in self.client.get("/api/reels/").data["results"]]

        self.assertEqual(titles, ["مثبّت", "ثاني", "أول"])

    def test_anonymous_cannot_create(self):
        response = self.client.post(
            "/api/reels/", {"title": "x", "facebook_url": "https://facebook.com/reel/x"}
        )

        self.assertIn(response.status_code, (401, 403))
        self.assertEqual(Reel.objects.count(), 0)

    def test_writer_cannot_create(self):
        """Front-page curation is an editor's call — same gate as the ticker."""
        self.client.force_authenticate(self.writer)

        response = self.client.post(
            "/api/reels/", {"title": "x", "facebook_url": "https://facebook.com/reel/x"}
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(Reel.objects.count(), 0)

    def test_editor_can_create(self):
        self.client.force_authenticate(self.editor)

        response = self.client.post(
            "/api/reels/", {"title": "ريل جديد", "facebook_url": "https://facebook.com/reel/9"}
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Reel.objects.get().title, "ريل جديد")

    def test_a_link_alone_is_a_complete_submission(self):
        """The dashboard form asks for nothing else — the API has to accept nothing else."""
        self.client.force_authenticate(self.editor)

        response = self.client.post("/api/reels/", {"facebook_url": "https://facebook.com/reel/9"})

        self.assertEqual(response.status_code, 201)

    def test_a_malformed_link_is_refused(self):
        """The link is the only thing the card does — a broken one is a dead card."""
        self.client.force_authenticate(self.editor)

        response = self.client.post("/api/reels/", {"title": "ريل", "facebook_url": "ليس رابطاً"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("facebook_url", response.data)




class OgImageExtractionTests(TestCase):
    """Reading the poster out of Facebook's markup."""

    def test_finds_og_image(self):
        from video.og import extract_og_image

        html = '<meta property="og:image" content="https://cdn.example/a.jpg" />'

        self.assertEqual(extract_og_image(html), "https://cdn.example/a.jpg")

    def test_finds_og_image_with_the_attributes_the_other_way_round(self):
        """Facebook's markup is minified and does not promise an order."""
        from video.og import extract_og_image

        html = '<meta content="https://cdn.example/b.jpg" property="og:image">'

        self.assertEqual(extract_og_image(html), "https://cdn.example/b.jpg")

    def test_unescapes_the_query_string(self):
        """
        An fbcdn poster URL is a dozen query parameters. Left HTML-escaped, the
        &amp; entities make an address that 404s rather than one merely ugly.
        """
        from video.og import extract_og_image

        html = '<meta property="og:image" content="https://cdn.example/c.jpg?a=1&amp;b=2&amp;oe=6A9E">'

        self.assertEqual(extract_og_image(html), "https://cdn.example/c.jpg?a=1&b=2&oe=6A9E")

    def test_falls_back_to_secure_url(self):
        from video.og import extract_og_image

        html = '<meta property="og:image:secure_url" content="https://cdn.example/d.jpg">'

        self.assertEqual(extract_og_image(html), "https://cdn.example/d.jpg")

    def test_a_login_wall_has_no_poster(self):
        """A private, deleted or blocked reel renders a valid page with no tag."""
        from video.og import extract_og_image

        self.assertIsNone(extract_og_image("<html><body>Log in to continue</body></html>"))


class OgTitleExtractionTests(TestCase):
    """
    Reading the caption out of Facebook's markup.

    Built against a real reel's markup, not an invented sample: og:title on
    that page was "2,2 тыс. просмотров | <the real headline> | الدفتر -
    aldaftar" — a Facebook-generated view-count in whatever locale it
    rendered with, wrapped around the real caption, wrapped again in the
    page's own site-name suffix — while og:description on the same page was
    the headline alone. That is the concrete reason fetch_og_metadata prefers
    description over title rather than trying to pattern-strip the wrapper.
    """

    REAL_OG_TITLE = (
        '<meta property="og:title" content="2,2&#xa0;&#x442;&#x44b;&#x441;.&#xa0;'
        "&#x43f;&#x440;&#x43e;&#x441;&#x43c;&#x43e;&#x442;&#x440;&#x43e;&#x432; | "
        "&#x635;&#x631;&#x641; &#x645;&#x633;&#x62a;&#x634;&#x641;&#x649; "
        "&#x627;&#x644;&#x639;&#x627;&#x645;&#x631;&#x64a;&#x629; | "
        '&#x627;&#x644;&#x62f;&#x641;&#x62a;&#x631; - aldaftar" />'
    )
    REAL_OG_DESCRIPTION = (
        '<meta property="og:description" content="&#x635;&#x631;&#x641; '
        '&#x645;&#x633;&#x62a;&#x634;&#x641;&#x649; &#x627;&#x644;&#x639;&#x627;&#x645;&#x631;&#x64a;&#x629;" />'
    )

    def test_finds_og_title(self):
        from video.og import extract_og_title

        html = '<meta property="og:title" content="عنوان الريل" />'

        self.assertEqual(extract_og_title(html), "عنوان الريل")

    def test_finds_og_description(self):
        from video.og import extract_og_description

        html = '<meta property="og:description" content="الوصف" />'

        self.assertEqual(extract_og_description(html), "الوصف")

    def test_decodes_numeric_character_references(self):
        """
        Facebook does not emit raw UTF-8 in this tag — an Arabic caption
        arrives as a run of &#xHEX; references, not just the &amp; a URL gets.
        """
        from video.og import extract_og_title

        self.assertEqual(extract_og_title(self.REAL_OG_TITLE), "2,2\xa0тыс.\xa0просмотров | صرف مستشفى العامرية | الدفتر - aldaftar")

    def test_metadata_prefers_the_clean_description_over_the_wrapped_title(self):
        from video.og import fetch_og_metadata_from_html

        title, _ = fetch_og_metadata_from_html(self.REAL_OG_TITLE + self.REAL_OG_DESCRIPTION)

        self.assertEqual(title, "صرف مستشفى العامرية")
        self.assertNotIn("просмотров", title)
        self.assertNotIn("aldaftar", title)

    def test_metadata_falls_back_to_title_when_there_is_no_description(self):
        """A post with a caption in og:title and nothing in og:description
        still has to produce a title — cleaned up, not thrown away."""
        from video.og import fetch_og_metadata_from_html

        title, _ = fetch_og_metadata_from_html('<meta property="og:title" content="عنوان فقط">')

        self.assertEqual(title, "عنوان فقط")

    def test_cleanup_collapses_whitespace_including_nbsp(self):
        from video.og import _clean_title

        self.assertEqual(_clean_title("a\xa0\xa0 b   c\n\nd"), "a b c d")

    def test_cleanup_truncates_to_the_column_width(self):
        """
        The model column is varchar(200); Postgres enforces that at the
        database layer (unlike SQLite), so an untruncated caption would turn a
        successful scrape into a 500 on save rather than a long title.
        """
        from video.og import MAX_TITLE_LENGTH, _clean_title

        self.assertEqual(len(_clean_title("س" * 500)), MAX_TITLE_LENGTH)

    def test_a_login_wall_has_no_title_either(self):
        from video.og import extract_og_title

        self.assertIsNone(extract_og_title("<html><body>Log in to continue</body></html>"))


class OgHostAllowListTests(TestCase):
    """
    `facebook_url` is typed by a member of staff and then fetched by this
    server, so without a host gate the field is a server-side request to
    anything reachable from inside this network.
    """

    def test_refuses_a_host_that_is_not_facebook(self):
        from video.og import OgScrapeError, fetch_og_metadata

        for url in (
            "http://169.254.169.254/latest/meta-data/",
            "http://127.0.0.1:8300/api/articles/",
            "https://evil.example/reel/1",
            "file:///etc/passwd",
        ):
            with self.assertRaises(OgScrapeError, msg=url):
                fetch_og_metadata(url)

    def test_accepts_the_facebook_hosts_a_reel_link_actually_uses(self):
        from video import og

        for url in (
            "https://www.facebook.com/reel/123",
            "https://facebook.com/reel/123",
            "https://m.facebook.com/reel/123",
            "https://fb.watch/abc/",
        ):
            self.assertTrue(og._host_allowed(url), url)


class CanonicalizeFacebookUrlTests(TestCase):
    """
    _canonicalize_facebook_url is the actual fix for the embed plugin's
    "Video Unavailable" error on a reel that plays fine on Facebook itself:
    verified live, a `/plugins/video.php?href=` request built from a
    `/share/r/<id>/` link — what staff's own "Share" button hands out — came
    back Facebook's own error box; the same reel's resolved `/reel/<id>/`
    permalink came back the real player. These test the URL cleanup alone,
    with no network involved.
    """

    def test_strips_the_tracking_query_string_facebooks_own_redirect_adds(self):
        from video.og import _canonicalize_facebook_url

        self.assertEqual(
            _canonicalize_facebook_url(
                "https://www.facebook.com/reel/1776867636680978/?rdid=yIeN6fX3mtQ3mjoL&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2Fr%2F1DTnCmMnfE%2F"
            ),
            "https://www.facebook.com/reel/1776867636680978/",
        )

    def test_folds_the_mobile_host_onto_www(self):
        from video.og import _canonicalize_facebook_url

        self.assertEqual(
            _canonicalize_facebook_url("https://m.facebook.com/reel/123/"),
            "https://www.facebook.com/reel/123/",
        )

    def test_folds_the_bare_host_onto_www(self):
        from video.og import _canonicalize_facebook_url

        self.assertEqual(
            _canonicalize_facebook_url("https://facebook.com/reel/123/"),
            "https://www.facebook.com/reel/123/",
        )

    def test_leaves_an_already_canonical_url_untouched(self):
        from video.og import _canonicalize_facebook_url

        self.assertEqual(
            _canonicalize_facebook_url("https://www.facebook.com/reel/123/"),
            "https://www.facebook.com/reel/123/",
        )

    def test_refuses_a_host_facebook_url_may_not_even_hold(self):
        """Defence in depth: a redirect that somehow left every Facebook
        host must never be adopted as the reel's new link."""
        from video.og import _canonicalize_facebook_url

        self.assertIsNone(_canonicalize_facebook_url("https://evil.example/reel/123"))


class AttachScrapedMetadataUrlNormalizationTests(TestCase):
    """
    attach_scraped_metadata is where the canonical URL actually lands on the
    row — end to end, with a mocked `requests.get` standing in for
    Facebook's redirect chain.
    """

    @staticmethod
    def _response(*, url, text="<html></html>", status_code=200):
        return mock.Mock(status_code=status_code, text=text, url=url)

    def test_a_share_link_is_replaced_by_the_resolved_canonical_url(self):
        from video import og

        reel = Reel.objects.create(
            title="ريل", facebook_url="https://www.facebook.com/share/r/1DTnCmMnfE/"
        )
        resolved = "https://www.facebook.com/reel/1776867636680978/?rdid=abc&share_url=x"
        with mock.patch("video.og.requests.get", return_value=self._response(url=resolved)):
            title_set, image_set = og.attach_scraped_metadata(
                reel, want_title=False, want_image=False
            )

        self.assertFalse(title_set)
        self.assertFalse(image_set)
        reel.refresh_from_db()
        self.assertEqual(reel.facebook_url, "https://www.facebook.com/reel/1776867636680978/")

    def test_an_already_canonical_url_is_not_rewritten_or_resaved(self):
        from video import og

        canonical = "https://www.facebook.com/reel/999/"
        reel = Reel.objects.create(title="ريل", facebook_url=canonical)
        with mock.patch("video.og.requests.get", return_value=self._response(url=canonical)):
            og.attach_scraped_metadata(reel, want_title=False, want_image=False)

        reel.refresh_from_db()
        self.assertEqual(reel.facebook_url, canonical)

    def test_url_normalization_can_be_turned_off(self):
        """The management backfill's picture-only counterpart, and any other
        caller that means to touch just one field, must still be able to."""
        from video import og

        share_link = "https://www.facebook.com/share/r/xyz/"
        reel = Reel.objects.create(title="ريل", facebook_url=share_link)
        resolved = "https://www.facebook.com/reel/42/"
        with mock.patch("video.og.requests.get", return_value=self._response(url=resolved)):
            og.attach_scraped_metadata(
                reel, want_title=True, want_image=False, want_url_normalize=False
            )

        reel.refresh_from_db()
        self.assertEqual(reel.facebook_url, share_link)

    def test_a_failed_fetch_leaves_the_link_untouched(self):
        from video import og

        share_link = "https://www.facebook.com/share/r/down/"
        reel = Reel.objects.create(title="ريل", facebook_url=share_link)
        with mock.patch("video.og.requests.get", side_effect=OSError("network down")):
            title_set, image_set = og.attach_scraped_metadata(
                reel, want_title=False, want_image=False
            )

        self.assertFalse(title_set)
        self.assertFalse(image_set)
        reel.refresh_from_db()
        self.assertEqual(reel.facebook_url, share_link)


class ReelMetadataFetchTests(APITestCase):
    """Creating a reel with only a link scrapes both its title and its poster."""

    def setUp(self):
        self.editor = User.objects.create_user(
            username="og-editor", password="pw", is_staff=True, role="editor"
        )
        self.client.force_authenticate(self.editor)

    def test_create_with_only_a_link_scrapes_both_halves(self):
        # Patched where it is USED, not where it is defined: video/serializers.py
        # imports the name directly, so patching video.og would leave the real
        # function bound — and these tests would reach out to facebook.com.
        with mock.patch(
            "video.serializers.attach_scraped_metadata", return_value=(True, True)
        ) as attach:
            response = self.client.post(
                "/api/reels/", {"facebook_url": "https://www.facebook.com/reel/1"}
            )

        self.assertEqual(response.status_code, 201)
        attach.assert_called_once()
        _, kwargs = attach.call_args
        self.assertTrue(kwargs["want_title"])
        self.assertTrue(kwargs["want_image"])

    def test_an_explicit_title_is_not_overwritten_by_the_scrape(self):
        """An editor who typed a title outranks whatever the page advertises."""
        with mock.patch(
            "video.serializers.attach_scraped_metadata", return_value=(False, True)
        ) as attach:
            response = self.client.post(
                "/api/reels/",
                {"title": "عنوان اخترته بنفسي", "facebook_url": "https://www.facebook.com/reel/2"},
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Reel.objects.get().title, "عنوان اخترته بنفسي")
        _, kwargs = attach.call_args
        self.assertFalse(kwargs["want_title"])
        self.assertTrue(kwargs["want_image"])

    def test_a_reel_with_no_scraped_title_is_not_left_blank(self):
        """
        The one case the scrape cannot fill in: no title sent, and the page
        carried neither og:description nor og:title. A blank cell reads as a
        rendering failure — the same doubt an unset thumbnail already caused
        once — so this is a placeholder TEXT, not a placeholder image.
        """
        with mock.patch("video.serializers.attach_scraped_metadata", return_value=(False, False)):
            response = self.client.post(
                "/api/reels/", {"facebook_url": "https://www.facebook.com/reel/3"}
            )

        self.assertEqual(response.status_code, 201)
        from video.og import UNTITLED_REEL_TITLE

        self.assertEqual(Reel.objects.get().title, UNTITLED_REEL_TITLE)

    def test_created_reel_gets_a_real_slug_derived_from_the_scraped_title(self):
        with mock.patch(
            "video.serializers.attach_scraped_metadata",
            return_value=(True, False),
            side_effect=lambda reel, **kw: setattr(reel, "title", "عنوان حقيقي من فيسبوك") or (True, False),
        ):
            response = self.client.post(
                "/api/reels/", {"facebook_url": "https://www.facebook.com/reel/scraped"}
            )

        self.assertEqual(response.status_code, 201)
        reel = Reel.objects.get()
        self.assertEqual(reel.slug, "عنوان-حقيقي-من-فيسبوك")
        self.assertEqual(response.data["slug"], reel.slug)

    def test_a_reel_with_no_scraped_title_still_gets_a_real_slug_not_the_placeholder(self):
        with mock.patch("video.serializers.attach_scraped_metadata", return_value=(False, False)):
            response = self.client.post(
                "/api/reels/", {"facebook_url": "https://www.facebook.com/reel/no-title"}
            )

        reel = Reel.objects.get()
        # UNTITLED_REEL_TITLE is Arabic — assign_slug() falls back to the
        # literal "reel" only when slugify() yields nothing at all, which an
        # Arabic string does not (allow_unicode=True keeps it), so this
        # should read as the untitled placeholder slugified, not "reel-N".
        self.assertFalse(reel.slug.startswith("reel-"))
        self.assertEqual(response.data["slug"], reel.slug)

    def test_a_failed_fetch_still_saves_the_reel(self):
        """
        A Facebook outage or a private video must cost the card its text and
        its picture, never its row — the newsroom still meant to publish it.
        """
        with mock.patch("video.serializers.attach_scraped_metadata", return_value=(False, False)):
            response = self.client.post(
                "/api/reels/", {"facebook_url": "https://www.facebook.com/reel/4"}
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Reel.objects.count(), 1)
        self.assertFalse(Reel.objects.get().thumbnail)

    def test_a_scrape_that_raises_cannot_break_the_save(self):
        with mock.patch("video.og.requests.get", side_effect=OSError("network down")):
            response = self.client.post(
                "/api/reels/", {"facebook_url": "https://www.facebook.com/reel/5"}
            )

        self.assertEqual(response.status_code, 201)

    def test_reordering_does_not_rescrape(self):
        """The rail is reordered one PATCH per card; each must not hit Facebook."""
        with mock.patch("video.serializers.attach_scraped_metadata", return_value=(True, True)):
            reel = Reel.objects.create(
                title="ريل", facebook_url="https://www.facebook.com/reel/6"
            )

        with mock.patch("video.serializers.attach_scraped_metadata") as attach:
            response = self.client.patch(f"/api/reels/{reel.id}/", {"order": 3})

        self.assertEqual(response.status_code, 200)
        attach.assert_not_called()

    def test_changing_the_link_rescrapes_both_halves(self):
        with mock.patch("video.serializers.attach_scraped_metadata", return_value=(True, True)):
            reel = Reel.objects.create(
                title="ريل", facebook_url="https://www.facebook.com/reel/7"
            )

        with mock.patch(
            "video.serializers.attach_scraped_metadata", return_value=(True, True)
        ) as attach:
            response = self.client.patch(
                f"/api/reels/{reel.id}/", {"facebook_url": "https://www.facebook.com/reel/8"}
            )

        self.assertEqual(response.status_code, 200)
        attach.assert_called_once()
        _, kwargs = attach.call_args
        self.assertTrue(kwargs["want_title"])
        self.assertTrue(kwargs["want_image"])

    def test_changing_the_link_while_also_setting_a_title_keeps_that_title(self):
        with mock.patch("video.serializers.attach_scraped_metadata", return_value=(True, True)):
            reel = Reel.objects.create(
                title="ريل", facebook_url="https://www.facebook.com/reel/9"
            )

        with mock.patch(
            "video.serializers.attach_scraped_metadata", return_value=(False, True)
        ) as attach:
            response = self.client.patch(
                f"/api/reels/{reel.id}/",
                {"facebook_url": "https://www.facebook.com/reel/10", "title": "عنوان جديد"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Reel.objects.get().title, "عنوان جديد")
        _, kwargs = attach.call_args
        self.assertFalse(kwargs["want_title"])
        self.assertTrue(kwargs["want_image"])


class RevalidationSignalTests(TestCase):
    """
    «بالمختصر» reads on the home page's own ISR window (up to ~90s), same as
    every list on the site — but a save or delete on Reel/Video used to be
    the one write path with no signal wired to flush that cache early, unlike
    Article/Section/Story (see content/signals.py). This is the newsroom's
    own report: the dashboard showed a second reel immediately (it fetches
    with FRESH, i.e. revalidate: 0) while the public home page had not yet
    reached its own window.

    Patched where it is USED (`video.signals.revalidate_site`), not where it
    is defined (`content.revalidate`) — video/signals.py imports the name
    directly, so patching the defining module would leave the real,
    thread-spawning function bound here.
    """

    def test_creating_a_reel_revalidates(self):
        with mock.patch("video.signals.revalidate_site") as revalidate:
            Reel.objects.create(title="ريل", facebook_url="https://facebook.com/reel/1")

        revalidate.assert_called_once()

    def test_updating_a_reel_revalidates(self):
        reel = Reel.objects.create(title="ريل", facebook_url="https://facebook.com/reel/2")

        with mock.patch("video.signals.revalidate_site") as revalidate:
            reel.order = 3
            reel.save()

        revalidate.assert_called_once()

    def test_deleting_a_reel_revalidates(self):
        reel = Reel.objects.create(title="ريل", facebook_url="https://facebook.com/reel/3")

        with mock.patch("video.signals.revalidate_site") as revalidate:
            reel.delete()

        revalidate.assert_called_once()

    def test_creating_a_video_revalidates(self):
        """The /video desk had the identical gap — same fix, same file."""
        with mock.patch("video.signals.revalidate_site") as revalidate:
            Video.objects.create(title="فيديو", slug="v-signal-1")

        revalidate.assert_called_once()

    def test_deleting_a_video_revalidates(self):
        video = Video.objects.create(title="فيديو", slug="v-signal-2")

        with mock.patch("video.signals.revalidate_site") as revalidate:
            video.delete()

        revalidate.assert_called_once()

    def test_a_video_comment_does_not_revalidate(self):
        """
        The public pages this signal protects render article/reel/video LISTS
        — a comment is moderation-queue content a reader never sees until
        approved, on a page (the video detail page) that isn't even ISR'd the
        same way. Wiring the whole app's write traffic to this would flush
        the site's cache on every anonymous comment submission, for no
        visible change to any cached page.
        """
        video = Video.objects.create(title="فيديو", slug="v-signal-3")

        with mock.patch("video.signals.revalidate_site") as revalidate:
            VideoComment.objects.create(video=video, name="قارئ", text="تعليق")

        revalidate.assert_not_called()
