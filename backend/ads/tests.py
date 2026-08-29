"""Tests for ad placements — mainly the derived CTR the dashboard renders."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase

from ads.models import AdPlacement

User = get_user_model()


class AdPlacementModelTests(TestCase):
    def test_ctr_is_percentage_to_two_decimals(self):
        placement = AdPlacement.objects.create(name="أعلى الهيدر", size="728×90", impressions=128400, clicks=612)

        self.assertEqual(placement.ctr, 0.48)

    def test_ctr_is_zero_when_never_shown(self):
        """A placement with no impressions must not raise ZeroDivisionError."""
        placement = AdPlacement.objects.create(name="جديد", size="300×250", impressions=0, clicks=0)

        self.assertEqual(placement.ctr, 0.0)

    def test_ctr_handles_full_click_through(self):
        placement = AdPlacement.objects.create(name="مثالي", size="1×1", impressions=100, clicks=100)

        self.assertEqual(placement.ctr, 100.0)

    def test_placements_are_ordered(self):
        AdPlacement.objects.create(name="ثالث", size="a", order=3)
        AdPlacement.objects.create(name="أول", size="b", order=1)

        self.assertEqual([p.name for p in AdPlacement.objects.all()], ["أول", "ثالث"])


class AdPlacementAPITests(APITestCase):
    def setUp(self):
        # Ad performance figures are internal monetization data with no
        # public consumer (see ads/views.py) — the whole endpoint is
        # staff-only now, GET included.
        self.staff = User.objects.create(username="ads-staff", is_staff=True, role="editor")
        self.client.force_authenticate(self.staff)

    def test_list_exposes_ctr(self):
        AdPlacement.objects.create(name="داخل المتن", size="336×280", impressions=84210, clicks=940)

        res = self.client.get("/api/ads/")

        self.assertAlmostEqual(res.json()["results"][0]["ctr"], 1.12, places=2)

    def test_toggle_active(self):
        placement = AdPlacement.objects.create(name="جانبي", size="300×600", active=True)

        res = self.client.patch(f"/api/ads/{placement.pk}/", {"active": False}, format="json")

        self.assertEqual(res.status_code, 200)
        placement.refresh_from_db()
        self.assertFalse(placement.active)

    def test_anonymous_read_is_forbidden(self):
        """regression: impressions/clicks/CTR are internal monetization
        figures with no public page rendering them — unlike currencies or
        weather, even GET must not be world-readable."""
        AdPlacement.objects.create(name="داخل المتن", size="336×280", impressions=84210, clicks=940)
        self.client.force_authenticate(user=None)

        res = self.client.get("/api/ads/")

        self.assertEqual(res.status_code, 403)
