"""Tests for site settings (a singleton) and the daily-visit series that
feeds the dashboard's 7-day chart."""
import datetime

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from siteconfig.models import DailyVisit, SiteSettings, SocialLink, WelcomeAlert


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
