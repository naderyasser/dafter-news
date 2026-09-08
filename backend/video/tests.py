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
    project fetched from YouTube.
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
        reel = Reel(title="عنوان الريل", url="https://www.youtube.com/shorts/AAAAAAAAAA1")

        reel.assign_slug()

        self.assertEqual(reel.slug, "عنوان-الريل")

    def test_a_second_reel_with_the_same_title_gets_a_distinct_slug(self):
        first = Reel.objects.create(title="نفس العنوان", url="https://www.youtube.com/shorts/AAAAAAAAAA1")
        # A freshly-created row holds its `reel-<pk>` placeholder (see
        # test_a_brand_new_row_gets_a_placeholder_slug_immediately) until
        # something finalizes it — done here explicitly so this test's
        # collision is against the REAL slug, matching what
        # ReelSerializer._finalize does moments after create() in practice.
        first.assign_slug()
        first.save(update_fields=["slug"])
        second = Reel(title="نفس العنوان", url="https://www.youtube.com/shorts/AAAAAAAAAA2")

        second.assign_slug()

        self.assertEqual(second.slug, "نفس-العنوان-2")

    def test_falls_back_to_a_literal_when_the_title_yields_nothing_slugifiable(self):
        reel = Reel(title="!!!", url="https://www.youtube.com/shorts/AAAAAAAAAA1")

        reel.assign_slug()

        self.assertEqual(reel.slug, "reel")

    def test_re_assigning_does_not_collide_with_its_own_previous_slug(self):
        """`.exclude(pk=self.pk)` — re-deriving a slug for a row that already
        holds one must not treat its own old value as a collision."""
        reel = Reel.objects.create(title="عنوان أول", url="https://www.youtube.com/shorts/AAAAAAAAAA1")
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
        reel = Reel.objects.create(url="https://www.youtube.com/shorts/AAAAAAAAAA1")

        self.assertEqual(reel.slug, f"reel-{reel.pk}")

    def test_an_already_titled_row_still_gets_the_placeholder_first(self):
        """
        Deliberately not smarter about this — Reel.save() does not check
        whether title happens to be known already; ReelSerializer._finalize
        is what replaces the placeholder with a real one right after,
        regardless of how the row got its title. See Reel.save()'s docstring.
        """
        reel = Reel.objects.create(title="عنوان معروف مسبقاً", url="https://www.youtube.com/shorts/AAAAAAAAAA1")

        self.assertEqual(reel.slug, f"reel-{reel.pk}")

    def test_updating_an_existing_row_does_not_re_placeholder_its_slug(self):
        reel = Reel.objects.create(title="عنوان", url="https://www.youtube.com/shorts/AAAAAAAAAA1")
        reel.assign_slug()
        reel.save(update_fields=["slug"])
        real_slug = reel.slug

        reel.order = 5
        reel.save()

        self.assertEqual(reel.slug, real_slug)


class ReelApiTests(APITestCase):
    """
    «بالمختصر» — the YouTube shorts shelf on the home page.

    Permissions, ordering and validation — not the scrape itself, which is
    OgImageExtractionTests/OgTitleExtractionTests/ReelMetadataFetchTests' job.
    `attach_scraped_metadata` is patched out for the whole class so a create()
    here never fires a real request at youtube.com; ordinary Django test runs
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
        Reel.objects.create(title="ريل", url="https://www.youtube.com/shorts/AAAAAAAAAA1")

        response = self.client.get("/api/reels/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)

    def test_ordering_is_order_then_newest(self):
        """`order` pins a reel to the head of the rail; the rest run newest-first."""
        Reel.objects.create(title="أول", url="https://www.youtube.com/shorts/AAAAAAAAAAa", order=1)
        Reel.objects.create(title="ثاني", url="https://www.youtube.com/shorts/AAAAAAAAAAb", order=1)
        Reel.objects.create(title="مثبّت", url="https://www.youtube.com/shorts/AAAAAAAAAAc", order=0)

        titles = [r["title"] for r in self.client.get("/api/reels/").data["results"]]

        self.assertEqual(titles, ["مثبّت", "ثاني", "أول"])

    def test_anonymous_cannot_create(self):
        response = self.client.post(
            "/api/reels/", {"title": "x", "url": "https://www.youtube.com/shorts/AAAAAAAAAAx"}
        )

        self.assertIn(response.status_code, (401, 403))
        self.assertEqual(Reel.objects.count(), 0)

    def test_writer_cannot_create(self):
        """Front-page curation is an editor's call — same gate as the ticker."""
        self.client.force_authenticate(self.writer)

        response = self.client.post(
            "/api/reels/", {"title": "x", "url": "https://www.youtube.com/shorts/AAAAAAAAAAx"}
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(Reel.objects.count(), 0)

    def test_editor_can_create(self):
        self.client.force_authenticate(self.editor)

        response = self.client.post(
            "/api/reels/", {"title": "ريل جديد", "url": "https://www.youtube.com/shorts/AAAAAAAAAA9"}
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Reel.objects.get().title, "ريل جديد")

    def test_a_link_alone_is_a_complete_submission(self):
        """The dashboard form asks for nothing else — the API has to accept nothing else."""
        self.client.force_authenticate(self.editor)

        response = self.client.post("/api/reels/", {"url": "https://www.youtube.com/shorts/AAAAAAAAAA9"})

        self.assertEqual(response.status_code, 201)

    def test_a_link_that_is_not_youtube_is_refused(self):
        """A Facebook link, a channel page, a tweet — none of them can play in
        the rail, so none of them may become a card."""
        self.client.force_authenticate(self.editor)

        response = self.client.post("/api/reels/", {"url": "https://www.facebook.com/reel/1776867636680978/"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("يوتيوب", response.data["url"][0])
        self.assertEqual(Reel.objects.count(), 0)

    def test_the_same_video_cannot_be_added_twice(self):
        self.client.force_authenticate(self.editor)
        Reel.objects.create(title="موجود", url="https://youtu.be/eF44mfjFjW8")

        response = self.client.post("/api/reels/", {"url": "https://www.youtube.com/shorts/eF44mfjFjW8?feature=share"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("مضاف بالفعل", response.data["url"][0])
        self.assertEqual(Reel.objects.count(), 1)

    def test_editing_a_reel_does_not_trip_over_its_own_link(self):
        self.client.force_authenticate(self.editor)
        reel = Reel.objects.create(title="موجود", url="https://youtu.be/eF44mfjFjW8")

        response = self.client.patch(f"/api/reels/{reel.id}/", {"url": "https://youtu.be/eF44mfjFjW8", "order": 2})

        self.assertEqual(response.status_code, 200)

    def test_a_malformed_link_is_refused(self):
        """The link is the only thing the card does — a broken one is a dead card."""
        self.client.force_authenticate(self.editor)

        response = self.client.post("/api/reels/", {"title": "ريل", "url": "ليس رابطاً"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("url", response.data)




class VideoIdExtractionTests(TestCase):
    """`extract_video_id` — the pure parser everything else is built on."""

    def test_every_link_shape_youtube_hands_out(self):
        from video.youtube import extract_video_id

        for url in [
            "https://www.youtube.com/shorts/eF44mfjFjW8",
            "https://youtube.com/shorts/eF44mfjFjW8?feature=share",
            "https://www.youtube.com/watch?v=eF44mfjFjW8&t=12s",
            "https://m.youtube.com/watch?v=eF44mfjFjW8",
            "https://youtu.be/eF44mfjFjW8?si=Ab12-_xyz",
            "https://www.youtube.com/embed/eF44mfjFjW8",
            "https://www.youtube.com/live/eF44mfjFjW8",
            "  https://www.youtube.com/shorts/eF44mfjFjW8/  ",
        ]:
            with self.subTest(url=url):
                self.assertEqual(extract_video_id(url), "eF44mfjFjW8")

    def test_refuses_anything_that_is_not_a_youtube_video(self):
        from video.youtube import extract_video_id

        for url in [
            "https://www.facebook.com/reel/1776867636680978/",
            "https://evil.example/shorts/eF44mfjFjW8",
            "https://www.youtube.com/@aldaftar",
            "https://www.youtube.com/shorts/too-short",
            "ftp://youtu.be/eF44mfjFjW8",
            "ليس رابطاً",
            "",
            None,
        ]:
            with self.subTest(url=url):
                self.assertIsNone(extract_video_id(url))


class _FakeResponse:
    def __init__(self, status=200, body=b"", json_data=None):
        self.status_code = status
        self._body = body
        self._json = json_data

    def iter_content(self, size):
        for i in range(0, len(self._body), size):
            yield self._body[i : i + size]

    def json(self):
        if self._json is None:
            raise ValueError("not json")
        return self._json


def _jpeg(width, height):
    """A real, decodable JPEG of the given size — the thumbnail picker checks
    dimensions, not just status codes."""
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (width, height), "red").save(buf, format="JPEG")
    return buf.getvalue()


class TitleFetchTests(TestCase):
    """oEmbed — the keyless endpoint the title comes from."""

    def test_reads_the_title_out_of_the_oembed_answer(self):
        from video import youtube

        with mock.patch(
            "video.youtube.requests.get",
            return_value=_FakeResponse(json_data={"title": "  الجزء\xa0التاني  من  الحكاية "}),
        ) as get:
            title = youtube.fetch_title("eF44mfjFjW8")

        self.assertEqual(title, "الجزء التاني من الحكاية")
        _, kwargs = get.call_args
        self.assertEqual(kwargs["params"]["url"], "https://www.youtube.com/watch?v=eF44mfjFjW8")

    def test_truncates_to_the_column_width(self):
        from video import youtube

        with mock.patch("video.youtube.requests.get", return_value=_FakeResponse(json_data={"title": "ع" * 500})):
            title = youtube.fetch_title("eF44mfjFjW8")

        self.assertEqual(len(title), youtube.MAX_TITLE_LENGTH)

    def test_a_private_video_answers_no_title(self):
        from video import youtube

        with mock.patch("video.youtube.requests.get", return_value=_FakeResponse(status=401)):
            with self.assertRaises(youtube.YouTubeError):
                youtube.fetch_title("eF44mfjFjW8")


class ThumbnailFetchTests(TestCase):
    """The poster picker: best variant first, placeholders skipped."""

    def _serve(self, variants):
        """A requests.get stand-in answering each variant from `variants`
        (a dict of variant name -> _FakeResponse); anything else is a 404."""

        def get(url, **kwargs):
            name = url.rsplit("/", 1)[-1].removesuffix(".jpg")
            return variants.get(name, _FakeResponse(status=404))

        return mock.patch("video.youtube.requests.get", side_effect=get)

    def test_prefers_the_vertical_shorts_frame(self):
        from video import youtube

        with self._serve({"oar1": _FakeResponse(body=_jpeg(720, 1280)), "maxresdefault": _FakeResponse(body=_jpeg(1280, 720))}):
            raw, ext = youtube.fetch_thumbnail("eF44mfjFjW8")

        self.assertEqual(ext, "jpg")
        self.assertEqual(raw, _jpeg(720, 1280))

    def test_falls_through_to_the_landscape_frame_when_no_vertical_one_exists(self):
        from video import youtube

        with self._serve({"maxresdefault": _FakeResponse(body=_jpeg(1280, 720)), "hqdefault": _FakeResponse(body=_jpeg(480, 360))}):
            raw, _ = youtube.fetch_thumbnail("eF44mfjFjW8")

        self.assertEqual(raw, _jpeg(1280, 720))

    def test_skips_the_grey_placeholder_ytimg_serves_with_a_200(self):
        from video import youtube

        with self._serve({"maxresdefault": _FakeResponse(body=_jpeg(120, 90)), "hqdefault": _FakeResponse(body=_jpeg(480, 360))}):
            raw, _ = youtube.fetch_thumbnail("eF44mfjFjW8")

        self.assertEqual(raw, _jpeg(480, 360))

    def test_skips_bytes_that_are_not_an_image(self):
        from video import youtube

        with self._serve({"maxresdefault": _FakeResponse(body=b"<html>not a picture</html>"), "hqdefault": _FakeResponse(body=_jpeg(480, 360))}):
            raw, _ = youtube.fetch_thumbnail("eF44mfjFjW8")

        self.assertEqual(raw, _jpeg(480, 360))

    def test_answers_none_when_no_variant_qualifies(self):
        from video import youtube

        with self._serve({}):
            self.assertIsNone(youtube.fetch_thumbnail("eF44mfjFjW8"))

    def test_only_ever_fetches_from_youtubes_own_thumbnail_host(self):
        from video import youtube

        with mock.patch("video.youtube.requests.get", return_value=_FakeResponse(status=404)) as get:
            youtube.fetch_thumbnail("eF44mfjFjW8")

        for call in get.call_args_list:
            self.assertTrue(call.args[0].startswith("https://i.ytimg.com/vi/eF44mfjFjW8/"), call.args[0])


class AttachScrapedMetadataTests(TestCase):
    """The seam the serializer and the backfill command both call."""

    def test_fills_both_halves_and_saves(self):
        from video import youtube

        reel = Reel.objects.create(url="https://youtu.be/eF44mfjFjW8")
        with mock.patch("video.youtube.fetch_title", return_value="عنوان من يوتيوب"), mock.patch(
            "video.youtube.fetch_thumbnail", return_value=(_jpeg(720, 1280), "jpg")
        ):
            title_set, image_set = youtube.attach_scraped_metadata(reel)

        self.assertTrue(title_set)
        self.assertTrue(image_set)
        reel.refresh_from_db()
        self.assertEqual(reel.title, "عنوان من يوتيوب")
        self.assertTrue(reel.thumbnail.name.startswith("reels/eF44mfjFjW8"))

    def test_asks_only_for_the_halves_it_was_told_to(self):
        from video import youtube

        reel = Reel.objects.create(title="عنوان يدوي", url="https://youtu.be/eF44mfjFjW8")
        with mock.patch("video.youtube.fetch_title") as fetch_title, mock.patch(
            "video.youtube.fetch_thumbnail", return_value=None
        ):
            youtube.attach_scraped_metadata(reel, want_title=False, want_image=True)

        fetch_title.assert_not_called()
        self.assertEqual(Reel.objects.get().title, "عنوان يدوي")

    def test_a_row_without_a_youtube_id_is_left_alone(self):
        from video import youtube

        # A Facebook-era row kept by migration 0008: nothing to fetch from.
        reel = Reel.objects.create(title="قديم", url="https://www.facebook.com/reel/1/")
        with mock.patch("video.youtube.requests.get") as get:
            self.assertEqual(youtube.attach_scraped_metadata(reel), (False, False))

        get.assert_not_called()

    def test_a_network_failure_never_raises(self):
        from video import youtube

        reel = Reel.objects.create(url="https://youtu.be/eF44mfjFjW8")
        with mock.patch("video.youtube.requests.get", side_effect=OSError("network down")):
            self.assertEqual(youtube.attach_scraped_metadata(reel), (False, False))


class ReelYoutubeIdTests(TestCase):
    """`youtube_id` is stamped by the model on every save."""

    def test_derived_from_the_link_on_save(self):
        reel = Reel.objects.create(title="ريل", url="https://www.youtube.com/shorts/eF44mfjFjW8?feature=share")

        self.assertEqual(reel.youtube_id, "eF44mfjFjW8")

    def test_re_derived_when_the_link_changes(self):
        reel = Reel.objects.create(title="ريل", url="https://youtu.be/eF44mfjFjW8")
        reel.url = "https://youtu.be/dQw4w9WgXcQ"
        reel.save()

        self.assertEqual(Reel.objects.get().youtube_id, "dQw4w9WgXcQ")

    def test_blank_for_a_link_that_is_not_a_youtube_video(self):
        reel = Reel.objects.create(title="قديم", url="https://www.facebook.com/reel/1/")

        self.assertEqual(reel.youtube_id, "")



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
                "/api/reels/", {"url": "https://www.youtube.com/shorts/AAAAAAAAAA1"}
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
                {"title": "عنوان اخترته بنفسي", "url": "https://www.youtube.com/shorts/AAAAAAAAAA2"},
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
                "/api/reels/", {"url": "https://www.youtube.com/shorts/AAAAAAAAAA3"}
            )

        self.assertEqual(response.status_code, 201)
        from video.youtube import UNTITLED_REEL_TITLE

        self.assertEqual(Reel.objects.get().title, UNTITLED_REEL_TITLE)

    def test_created_reel_gets_a_real_slug_derived_from_the_scraped_title(self):
        with mock.patch(
            "video.serializers.attach_scraped_metadata",
            return_value=(True, False),
            side_effect=lambda reel, **kw: setattr(reel, "title", "عنوان حقيقي من يوتيوب") or (True, False),
        ):
            response = self.client.post(
                "/api/reels/", {"url": "https://www.youtube.com/shorts/AAAAscraped"}
            )

        self.assertEqual(response.status_code, 201)
        reel = Reel.objects.get()
        self.assertEqual(reel.slug, "عنوان-حقيقي-من-يوتيوب")
        self.assertEqual(response.data["slug"], reel.slug)

    def test_a_reel_with_no_scraped_title_still_gets_a_real_slug_not_the_placeholder(self):
        with mock.patch("video.serializers.attach_scraped_metadata", return_value=(False, False)):
            response = self.client.post(
                "/api/reels/", {"url": "https://www.youtube.com/shorts/AAAAnotitle"}
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
        A YouTube outage or a private video must cost the card its text and
        its picture, never its row — the newsroom still meant to publish it.
        """
        with mock.patch("video.serializers.attach_scraped_metadata", return_value=(False, False)):
            response = self.client.post(
                "/api/reels/", {"url": "https://www.youtube.com/shorts/AAAAAAAAAA4"}
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Reel.objects.count(), 1)
        self.assertFalse(Reel.objects.get().thumbnail)

    def test_a_scrape_that_raises_cannot_break_the_save(self):
        with mock.patch("video.youtube.requests.get", side_effect=OSError("network down")):
            response = self.client.post(
                "/api/reels/", {"url": "https://www.youtube.com/shorts/AAAAAAAAAA5"}
            )

        self.assertEqual(response.status_code, 201)

    def test_reordering_does_not_rescrape(self):
        """The rail is reordered one PATCH per card; each must not hit YouTube."""
        with mock.patch("video.serializers.attach_scraped_metadata", return_value=(True, True)):
            reel = Reel.objects.create(
                title="ريل", url="https://www.youtube.com/shorts/AAAAAAAAAA6"
            )

        with mock.patch("video.serializers.attach_scraped_metadata") as attach:
            response = self.client.patch(f"/api/reels/{reel.id}/", {"order": 3})

        self.assertEqual(response.status_code, 200)
        attach.assert_not_called()

    def test_changing_the_link_rescrapes_both_halves(self):
        with mock.patch("video.serializers.attach_scraped_metadata", return_value=(True, True)):
            reel = Reel.objects.create(
                title="ريل", url="https://www.youtube.com/shorts/AAAAAAAAAA7"
            )

        with mock.patch(
            "video.serializers.attach_scraped_metadata", return_value=(True, True)
        ) as attach:
            response = self.client.patch(
                f"/api/reels/{reel.id}/", {"url": "https://www.youtube.com/shorts/AAAAAAAAAA8"}
            )

        self.assertEqual(response.status_code, 200)
        attach.assert_called_once()
        _, kwargs = attach.call_args
        self.assertTrue(kwargs["want_title"])
        self.assertTrue(kwargs["want_image"])

    def test_changing_the_link_while_also_setting_a_title_keeps_that_title(self):
        with mock.patch("video.serializers.attach_scraped_metadata", return_value=(True, True)):
            reel = Reel.objects.create(
                title="ريل", url="https://www.youtube.com/shorts/AAAAAAAAAA9"
            )

        with mock.patch(
            "video.serializers.attach_scraped_metadata", return_value=(False, True)
        ) as attach:
            response = self.client.patch(
                f"/api/reels/{reel.id}/",
                {"url": "https://www.youtube.com/shorts/AAAAAAAAA10", "title": "عنوان جديد"},
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
            Reel.objects.create(title="ريل", url="https://www.youtube.com/shorts/AAAAAAAAAA1")

        revalidate.assert_called_once()

    def test_updating_a_reel_revalidates(self):
        reel = Reel.objects.create(title="ريل", url="https://www.youtube.com/shorts/AAAAAAAAAA2")

        with mock.patch("video.signals.revalidate_site") as revalidate:
            reel.order = 3
            reel.save()

        revalidate.assert_called_once()

    def test_deleting_a_reel_revalidates(self):
        reel = Reel.objects.create(title="ريل", url="https://www.youtube.com/shorts/AAAAAAAAAA3")

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
