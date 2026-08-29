"""
publish_scheduled — the actor behind the dashboard's scheduling promise.

The fields existed and the UI saved them; nothing fired them. These tests pin
the semantics: due means due, the editor's own switch is never fought, and
running the command twice is the same as running it once.
"""
import datetime
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from ads.models import AdPlacement
from content.models import Article, Section
from content.tts import TtsError


def run():
    out = StringIO()
    call_command("publish_scheduled", stdout=out)
    return out.getvalue()


class ScheduledArticleTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.section = Section.objects.create(key="egypt", name_ar="شؤون مصر", order=1)

    def make(self, minutes, **kw):
        return Article.objects.create(
            title=kw.pop("title", "مجدول"),
            slug=kw.pop("slug", f"sched-{minutes}"),
            section=self.section,
            status=kw.pop("status", Article.Status.SCHEDULED),
            scheduled_for=timezone.now() + datetime.timedelta(minutes=minutes),
            **kw,
        )

    def test_due_article_goes_live_and_is_stamped(self):
        art = self.make(-5)

        run()
        art.refresh_from_db()

        self.assertEqual(art.status, Article.Status.PUBLISHED)
        self.assertIsNotNone(art.published_at)
        # The record of intent survives the firing.
        self.assertIsNotNone(art.scheduled_for)

    def test_future_article_stays_scheduled(self):
        art = self.make(+30)

        run()
        art.refresh_from_db()

        self.assertEqual(art.status, Article.Status.SCHEDULED)
        self.assertIsNone(art.published_at)

    def test_only_scheduled_status_is_touched(self):
        """A draft with a stale scheduled_for is someone's abandoned plan,
        not a publish order."""
        draft = self.make(-60, status=Article.Status.DRAFT, slug="stale-draft")
        review = self.make(-60, status=Article.Status.REVIEW, slug="stale-review")

        run()

        draft.refresh_from_db()
        review.refresh_from_db()
        self.assertEqual(draft.status, Article.Status.DRAFT)
        self.assertEqual(review.status, Article.Status.REVIEW)

    def test_an_earlier_published_at_is_never_overwritten(self):
        original = timezone.now() - datetime.timedelta(days=7)
        art = self.make(-5, published_at=original, slug="republished")

        run()
        art.refresh_from_db()

        self.assertEqual(art.published_at, original)

    def test_idempotent(self):
        art = self.make(-5, slug="idem")

        first = run()
        second = run()
        art.refresh_from_db()

        self.assertEqual(art.status, Article.Status.PUBLISHED)
        self.assertIn("نُشر", first)
        self.assertIn("لا شيء مستحق", second)

    def test_due_article_becomes_publicly_readable(self):
        """The end-to-end point of the feature: the reader can open it."""
        art = self.make(-1, slug="goes-public", title="خبر الجدولة")

        run()

        res = self.client.get(f"/api/articles/{art.slug}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "published")


class ScheduledArticleTtsTests(TestCase):
    """
    An auto-publish at the scheduled minute is a real publish path — same
    reasoning as ArticleEditorForm.save() firing «توليد النسخة الصوتية» after
    the dashboard's own «حفظ ونشر»: the player must not be the one thing that
    silently stays empty depending on *which* publish path a story took.

    generate_for_article is mocked at this command's own import site — same
    as GenerateTtsViewTests — since it hits a real external endpoint.
    """

    @classmethod
    def setUpTestData(cls):
        cls.section = Section.objects.create(key="egypt", name_ar="شؤون مصر", order=1)

    def due(self, **kw):
        return Article.objects.create(
            title=kw.pop("title", "خبر"),
            slug=kw.pop("slug", "due"),
            section=self.section,
            status=Article.Status.SCHEDULED,
            scheduled_for=timezone.now() - datetime.timedelta(minutes=5),
            **kw,
        )

    def test_narrates_a_due_article_on_auto_publish(self):
        art = self.due(slug="sched-tts")

        with patch("content.management.commands.publish_scheduled.generate_for_article", return_value=42) as mocked:
            run()

        mocked.assert_called_once_with(art)

    def test_a_narration_failure_does_not_stop_other_articles_from_publishing_or_the_command(self):
        """One article's voice engine hiccup must not leave the next one
        stuck مجدول forever, and must not blow up the whole cron run."""
        first = self.due(slug="sched-fail")
        second = self.due(slug="sched-ok")

        with patch(
            "content.management.commands.publish_scheduled.generate_for_article",
            side_effect=TtsError("تعذّر الاتصال بمحرك الصوت"),
        ):
            run()

        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.status, Article.Status.PUBLISHED)
        self.assertEqual(second.status, Article.Status.PUBLISHED)


class ScheduledAdTests(TestCase):
    def window(self, start_min, end_min, active=False, name="حملة"):
        now = timezone.now()
        return AdPlacement.objects.create(
            name=name,
            size="728×90",
            active=active,
            scheduled_start=None if start_min is None else now + datetime.timedelta(minutes=start_min),
            scheduled_end=None if end_min is None else now + datetime.timedelta(minutes=end_min),
        )

    def test_start_arriving_turns_the_placement_on_once(self):
        ad = self.window(-5, +60)

        run()
        ad.refresh_from_db()

        self.assertTrue(ad.active)
        # Consumed: the editor can now switch it off without cron fighting back.
        self.assertIsNone(ad.scheduled_start)
        self.assertIsNotNone(ad.scheduled_end)

    def test_editor_pausing_mid_window_stays_paused(self):
        ad = self.window(-5, +60)
        run()
        ad.refresh_from_db()
        self.assertTrue(ad.active)

        # The editor's deliberate act.
        ad.active = False
        ad.save(update_fields=["active"])
        run()
        ad.refresh_from_db()

        self.assertFalse(ad.active)

    def test_end_arriving_turns_the_placement_off(self):
        ad = self.window(None, -1, active=True)

        run()
        ad.refresh_from_db()

        self.assertFalse(ad.active)
        self.assertIsNone(ad.scheduled_end)

    def test_future_window_waits(self):
        ad = self.window(+30, +90)

        run()
        ad.refresh_from_db()

        self.assertFalse(ad.active)
        self.assertIsNotNone(ad.scheduled_start)

    def test_fully_elapsed_window_never_activates(self):
        """Both edges in the past: the campaign was missed, not late —
        switching it on now would run an ad the client already stopped
        paying for."""
        ad = self.window(-120, -60)

        run()
        ad.refresh_from_db()

        self.assertFalse(ad.active)
        # ...and the stale pair is swept so the dashboard stops saying "pending".
        self.assertIsNone(ad.scheduled_start)
        self.assertIsNone(ad.scheduled_end)

    def test_unscheduled_placements_are_untouched(self):
        on = self.window(None, None, active=True, name="دائم")
        off = self.window(None, None, active=False, name="موقوف")

        run()

        on.refresh_from_db()
        off.refresh_from_db()
        self.assertTrue(on.active)
        self.assertFalse(off.active)
