"""Tests for the لقطة وتعليق video section and its comment thread."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase

from content.models import Section
from video.models import Video, VideoComment

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
        self.client.force_authenticate(User.objects.create(username="video-staff-4", is_staff=True))

        res = self.client.get("/api/videos/factory-tour/")

        self.assertEqual(len(res.json()["comments"]), 1)

    def test_detail_by_numeric_id(self):
        """regression: the videos dashboard PATCHes /videos/<id>/ while the
        viewset looks up by slug — the live/exclusive toggles 404'd silently."""
        res = self.client.get(f"/api/videos/{self.video.pk}/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["slug"], "factory-tour")

    def test_patch_toggle_by_numeric_id(self):
        self.client.force_authenticate(User.objects.create(username="video-staff-1", is_staff=True))

        res = self.client.patch(f"/api/videos/{self.video.pk}/", {"is_exclusive": False}, format="json")

        self.assertEqual(res.status_code, 200)
        self.video.refresh_from_db()
        self.assertFalse(self.video.is_exclusive)

    def test_patch_toggle_by_slug(self):
        self.client.force_authenticate(User.objects.create(username="video-staff-2", is_staff=True))

        res = self.client.patch("/api/videos/factory-tour/", {"is_live": True}, format="json")

        self.assertEqual(res.status_code, 200)
        self.video.refresh_from_db()
        self.assertTrue(self.video.is_live)

    def test_staff_can_set_the_view_count_shown_on_the_dashboard(self):
        """VideosManager's «👁» edit — an editorial override of the shown
        count, not a real-view tracker. Real views (if that's ever wired
        up) would only ever add on top of whatever's set here."""
        self.client.force_authenticate(User.objects.create(username="video-staff-5", is_staff=True))

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
        self.client.force_authenticate(User.objects.create(username="video-staff-5", is_staff=True))

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
        self.client.force_authenticate(User.objects.create(username="video-staff-3", is_staff=True))

        res = self.client.get(f"/api/video-comments/?video={self.video.pk}")

        self.assertEqual(res.json()["count"], 1)
