"""Tests for the markets data behind the sticky ticker and the الأسواق page.

Per brief §11 everything is served from one /api/ticker/ endpoint so the
sticky bar, the markets page and the dashboard all read the same payload.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase

from market.models import Currency, GoldKarat, TickerModule, WeatherCity

User = get_user_model()


class MarketModelTests(TestCase):
    def test_currencies_are_ordered(self):
        Currency.objects.create(code="SAR", buy=13, sell=13.05, order=4)
        Currency.objects.create(code="USD", buy=48.7, sell=48.85, order=1)

        self.assertEqual([c.code for c in Currency.objects.all()], ["USD", "SAR"])

    def test_series_round_trips_as_json(self):
        """The sparkline is drawn from this list, so it must survive storage
        as numbers rather than a stringified blob."""
        series = [48.2, 48.3, 48.5, 48.85]
        Currency.objects.create(code="USD", buy=48.7, sell=48.85, series=series)

        self.assertEqual(Currency.objects.get(code="USD").series, series)


class TickerEndpointTests(APITestCase):
    def setUp(self):
        Currency.objects.create(flag_emoji="🇺🇸", code="USD", buy=48.70, sell=48.85, change_pct=0.3, is_up=True, series=[48.2, 48.85], order=1)
        Currency.objects.create(flag_emoji="🇪🇺", code="EUR", buy=51.90, sell=52.10, change_pct=-0.15, is_up=False, series=[52.6, 52.1], order=2)
        GoldKarat.objects.create(label="عيار 21", price=3550, change_pct=0.8, is_up=True, order=2)
        WeatherCity.objects.create(key="cairo", label="القاهرة", icon="☀️", temp=34, hi=36, lo=24, humidity=32, order=1)
        WeatherCity.objects.create(key="alex", label="الإسكندرية", icon="⛅", temp=29, hi=31, lo=23, humidity=58, order=2)
        TickerModule.objects.create(key="currencies", label="العملات", source="البنك المركزي", active=True, order=1)
        TickerModule.objects.create(key="oil", label="النفط", source="خارجي", active=False, order=5)

    def test_payload_has_every_section_the_ui_needs(self):
        res = self.client.get("/api/ticker/")
        data = res.json()

        self.assertEqual(set(data.keys()), {"currencies", "gold", "weather", "cities", "modules"})
        self.assertEqual(len(data["currencies"]), 2)
        self.assertEqual(len(data["gold"]), 1)
        self.assertEqual(len(data["cities"]), 2)

    def test_only_active_modules_are_returned(self):
        """A module switched off in DashTicker must disappear from the bar."""
        res = self.client.get("/api/ticker/")

        keys = [m["key"] for m in res.json()["modules"]]
        self.assertEqual(keys, ["currencies"])

    def test_weather_defaults_to_first_city(self):
        res = self.client.get("/api/ticker/")

        self.assertEqual(res.json()["weather"]["key"], "cairo")

    def test_weather_respects_city_query(self):
        res = self.client.get("/api/ticker/?city=alex")

        self.assertEqual(res.json()["weather"]["label"], "الإسكندرية")

    def test_unknown_city_falls_back_instead_of_erroring(self):
        res = self.client.get("/api/ticker/?city=atlantis")

        self.assertEqual(res.status_code, 200)
        self.assertIsNotNone(res.json()["weather"])

    def test_direction_flag_is_independent_of_brand_colour(self):
        """Brief §10.3: market movement must use --up/--down, never the brand
        red. The API carries the direction so the UI can pick the right token."""
        res = self.client.get("/api/ticker/")
        by_code = {c["code"]: c for c in res.json()["currencies"]}

        self.assertTrue(by_code["USD"]["is_up"])
        self.assertFalse(by_code["EUR"]["is_up"])

    def test_ticker_is_serialisable_when_database_is_empty(self):
        Currency.objects.all().delete()
        GoldKarat.objects.all().delete()
        WeatherCity.objects.all().delete()
        TickerModule.objects.all().delete()

        res = self.client.get("/api/ticker/")

        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.json()["weather"])
        self.assertEqual(res.json()["currencies"], [])


class TickerModuleAPITests(APITestCase):
    def test_reorder_and_toggle(self):
        module = TickerModule.objects.create(key="gold", label="الذهب", active=True, order=2)
        self.client.force_authenticate(User.objects.create(username="ticker-staff", is_staff=True))

        res = self.client.patch(f"/api/ticker-modules/{module.pk}/", {"order": 1, "active": False}, format="json")

        self.assertEqual(res.status_code, 200)
        module.refresh_from_db()
        self.assertEqual(module.order, 1)
        self.assertFalse(module.active)
