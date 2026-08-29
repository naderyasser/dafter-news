"""Tests for site settings (a singleton) and the daily-visit series that
feeds the dashboard's 7-day chart."""
import datetime
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from siteconfig.models import DailyVisit, PushSubscription, SiteSettings, SocialLink, WelcomeAlert
from siteconfig.push import MAX_FAILURES, send_to_all

User = get_user_model()


class SiteSettingsSingletonTests(TestCase):
    def test_load_creates_a_single_row(self):
        first = SiteSettings.load()
        second = SiteSettings.load()

        self.assertEqual(first.pk, second.pk)
        self.assertEqual(SiteSettings.objects.count(), 1)

    def test_saving_a_second_instance_overwrites_the_first(self):
        """The settings form must never be able to fork into two records."""
        SiteSettings.objects.create(site_name="أول")
        SiteSettings.objects.create(site_name="ثان")

        self.assertEqual(SiteSettings.objects.count(), 1)
        self.assertEqual(SiteSettings.load().site_name, "ثان")

    def test_delete_is_a_no_op(self):
        settings_obj = SiteSettings.load()

        settings_obj.delete()

        self.assertEqual(SiteSettings.objects.count(), 1)


class DailyVisitTests(TestCase):
    def test_visits_are_newest_first(self):
        today = timezone.localdate()
        DailyVisit.objects.create(date=today - datetime.timedelta(days=2), visits=100)
        DailyVisit.objects.create(date=today, visits=300)

        self.assertEqual(DailyVisit.objects.first().visits, 300)

    def test_date_is_unique(self):
        from django.db.utils import IntegrityError

        today = timezone.localdate()
        DailyVisit.objects.create(date=today, visits=100)

        with self.assertRaises(IntegrityError):
            DailyVisit.objects.create(date=today, visits=200)


class SiteSettingsAPITests(APITestCase):
    def setUp(self):
        # Writing the settings singleton is admin-only: it holds the site name
        # and the SEO title/description that ship on every page, plus the
        # switches that take a whole language edition down. Reading stays open
        # — every page is built from it.
        self.admin = User.objects.create(username="settings-admin", is_staff=True, role=User.Role.ADMIN)
        self.staff = User.objects.create(username="settings-staff", is_staff=True, role=User.Role.EDITOR)
        self.client.force_authenticate(self.admin)

    def test_get_returns_settings_and_social_links(self):
        settings_obj = SiteSettings.load()
        settings_obj.site_name = "الدفتر نيوز"
        settings_obj.tagline = "سِجلّ اليوم.. خبراً خبراً"
        settings_obj.save()
        SocialLink.objects.create(platform="x", url="https://x.com/aldaftarnews")

        res = self.client.get("/api/settings/")
        data = res.json()

        self.assertEqual(data["site_name"], "الدفتر نيوز")
        self.assertEqual(data["tagline"], "سِجلّ اليوم.. خبراً خبراً")
        self.assertEqual(len(data["social_links"]), 1)
        self.assertEqual(data["social_links"][0]["platform"], "x")

    def test_get_creates_settings_on_first_call(self):
        """A fresh install has no row yet; the endpoint must not 404."""
        SiteSettings.objects.all().delete()

        res = self.client.get("/api/settings/")

        self.assertEqual(res.status_code, 200)

    def test_put_updates_in_place(self):
        SiteSettings.load()

        res = self.client.put(
            "/api/settings/",
            {"site_name": "اسم جديد", "seo_title": "عنوان SEO", "lang_en_enabled": False},
            format="json",
        )

        self.assertEqual(res.status_code, 200)
        settings_obj = SiteSettings.load()
        self.assertEqual(settings_obj.site_name, "اسم جديد")
        self.assertEqual(settings_obj.seo_title, "عنوان SEO")
        self.assertFalse(settings_obj.lang_en_enabled)
        self.assertEqual(SiteSettings.objects.count(), 1)

    def test_newsroom_staff_may_read_but_not_rewrite_the_settings(self):
        """
        An editor or moderator must not be able to rename the paper or rewrite
        the description every page carries into search results. They could
        until this was tightened — the blast radius of a moderator account was
        the whole site's identity.
        """
        SiteSettings.load()
        self.client.force_authenticate(self.staff)

        self.assertEqual(self.client.get("/api/settings/").status_code, 200)

        res = self.client.put("/api/settings/", {"site_name": "مُختطَف"}, format="json")

        self.assertEqual(res.status_code, 403)
        self.assertNotEqual(SiteSettings.load().site_name, "مُختطَف")

    def test_anonymous_may_read_but_not_rewrite(self):
        SiteSettings.load()
        self.client.force_authenticate(None)

        self.assertEqual(self.client.get("/api/settings/").status_code, 200)
        self.assertIn(self.client.put("/api/settings/", {"site_name": "x"}, format="json").status_code, (401, 403))

    def test_put_is_partial_and_keeps_untouched_fields(self):
        settings_obj = SiteSettings.load()
        settings_obj.tagline = "شعار محفوظ"
        settings_obj.save()

        self.client.put("/api/settings/", {"site_name": "اسم"}, format="json")

        self.assertEqual(SiteSettings.load().tagline, "شعار محفوظ")


class WelcomeAlertTests(TestCase):
    def test_load_is_a_singleton(self):
        first = WelcomeAlert.load()
        second = WelcomeAlert.load()

        self.assertEqual(first.pk, second.pk)
        self.assertEqual(WelcomeAlert.objects.count(), 1)

    def test_second_create_overwrites_rather_than_erroring(self):
        WelcomeAlert.objects.create(title="أول")
        WelcomeAlert.objects.create(title="ثان")

        self.assertEqual(WelcomeAlert.objects.count(), 1)
        self.assertEqual(WelcomeAlert.load().title, "ثان")

    def test_defaults_to_inactive(self):
        """A blank install must not pop an empty modal at every visitor."""
        self.assertFalse(WelcomeAlert.load().active)


class WelcomeAlertAPITests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create(username="alert-staff", is_staff=True, role="editor")
        self.client.force_authenticate(self.staff)

    def test_get_creates_the_row_on_first_call(self):
        WelcomeAlert.objects.all().delete()

        res = self.client.get("/api/welcome-alert/")

        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.json()["active"])

    def test_put_updates_copy_and_cta(self):
        res = self.client.put(
            "/api/welcome-alert/",
            {
                "active": True,
                "kicker": "يحدث الآن",
                "title": "تغطية لحظية",
                "text": "تفاصيل",
                "cta_label": "تابع",
                "cta_href": "/live",
            },
            format="json",
        )

        self.assertEqual(res.status_code, 200)
        alert = WelcomeAlert.load()
        self.assertTrue(alert.active)
        self.assertEqual(alert.cta_href, "/live")
        self.assertEqual(WelcomeAlert.objects.count(), 1)

    def test_switching_off_keeps_the_copy(self):
        """Editors switch the alert off between stories — the text should
        still be there when they turn it back on."""
        self.client.put("/api/welcome-alert/", {"active": True, "title": "خبر"}, format="json")
        self.client.put("/api/welcome-alert/", {"active": False}, format="json")

        alert = WelcomeAlert.load()
        self.assertFalse(alert.active)
        self.assertEqual(alert.title, "خبر")


class PushBroadcastTests(TestCase):
    """send_to_all()'s per-subscription failure handling."""

    def setUp(self):
        configured_patch = patch("siteconfig.push.configured", return_value=True)
        configured_patch.start()
        self.addCleanup(configured_patch.stop)

    def test_non_webpush_exception_is_counted_and_eventually_pruned(self):
        """regression: only the WebPushException branch touched
        failure_count/pruning. Any other exception (timeouts, connection
        errors, ...) landed in the bare `except Exception` and just did
        `failed += 1` — a systematically broken subscription never got
        pruned and never showed up anywhere. Reaching MAX_FAILURES via this
        path must prune the row exactly like a bad WebPush status code does."""
        sub = PushSubscription.objects.create(
            endpoint="https://push.example.com/near-limit", p256dh="k", auth="a",
            failure_count=MAX_FAILURES - 1,
        )

        with patch("siteconfig.push.webpush", side_effect=ConnectionError("boom")):
            sent, failed, pruned = send_to_all("عاجل", "خبر")

        self.assertEqual((sent, failed, pruned), (0, 1, 1))
        self.assertFalse(PushSubscription.objects.filter(pk=sub.pk).exists())

    def test_non_webpush_exception_increments_failure_count(self):
        """Same exception path, but below the prune threshold — the row
        must survive with its failure streak bumped by one, not silently
        unchanged."""
        sub = PushSubscription.objects.create(
            endpoint="https://push.example.com/fresh", p256dh="k", auth="a", failure_count=0,
        )

        with patch("siteconfig.push.webpush", side_effect=TimeoutError("slow")):
            sent, failed, pruned = send_to_all("عاجل", "خبر")

        self.assertEqual((sent, failed, pruned), (0, 1, 0))
        sub.refresh_from_db()
        self.assertEqual(sub.failure_count, 1)
