"""
Tests for the external-feed layer.

Every provider is exercised against a mocked HTTP layer using the response
shapes the real services document, plus the failure paths that matter far
more in production than the happy path: a dead host, a timeout, a 200 with
an error body, and a partially-valid payload.

The property under test throughout is that a bad upstream degrades to
"nothing changed" — never to blank prices on a live ticker.
"""
from datetime import date
from unittest.mock import patch

import requests
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from integrations.client import ProviderError, fetch_json, pct_change, push_series
from integrations.models import Match, PrayerTimes, SyncLog, WireArticle
from integrations.providers import currency, football, gold, newswire, prayer, weather
from market.models import Currency, GoldKarat, WeatherCity


class FakeResponse:
    def __init__(self, payload=None, status_code=200, raises=None):
        self._payload = payload
        self.status_code = status_code
        self._raises = raises

    def json(self):
        if self._raises:
            raise self._raises
        return self._payload


# --------------------------------------------------------------- base client
class FetchJsonTests(TestCase):
    def test_returns_parsed_json_on_200(self):
        with patch("integrations.client.requests.get", return_value=FakeResponse({"ok": True})):
            self.assertEqual(fetch_json("https://x.test"), {"ok": True})

    def test_returns_none_on_non_200(self):
        with patch("integrations.client.requests.get", return_value=FakeResponse(status_code=503)):
            self.assertIsNone(fetch_json("https://x.test"))

    def test_returns_none_on_timeout(self):
        with patch("integrations.client.requests.get", side_effect=requests.exceptions.Timeout):
            self.assertIsNone(fetch_json("https://x.test"))

    def test_returns_none_on_connection_error(self):
        with patch("integrations.client.requests.get", side_effect=requests.exceptions.ConnectionError):
            self.assertIsNone(fetch_json("https://x.test"))

    def test_returns_none_when_body_is_not_json(self):
        """A 200 carrying an HTML error page must not raise into the caller."""
        with patch("integrations.client.requests.get", return_value=FakeResponse(raises=ValueError("no json"))):
            self.assertIsNone(fetch_json("https://x.test"))


class SeriesHelperTests(TestCase):
    def test_appends_and_caps_length(self):
        self.assertEqual(push_series([1, 2, 3], 4, cap=3), [2, 3, 4])

    def test_recovers_when_stored_series_is_not_a_list(self):
        """series is a JSONField — a bad write upstream shouldn't blow up the
        chart at render time."""
        self.assertEqual(push_series("garbage", 5), [5.0])
        self.assertEqual(push_series(None, 5), [5.0])

    def test_drops_non_numeric_entries(self):
        self.assertEqual(push_series([1, "x", 3], 4), [1, 3, 4.0])

    def test_pct_change_computes_move(self):
        self.assertEqual(pct_change(100, 110), 10.0)
        self.assertEqual(pct_change(100, 90), -10.0)

    def test_pct_change_is_zero_without_a_baseline(self):
        self.assertEqual(pct_change(0, 50), 0.0)
        self.assertEqual(pct_change(None, 50), 0.0)


# ------------------------------------------------------------------ currency
FX_OK = {
    "base": "EGP",
    "rates": {"USD": 0.0205, "EUR": 0.0192, "GBP": 0.0165, "SAR": 0.0769, "AED": 0.0753, "KWD": 0.0063},
}


class CurrencyProviderTests(TestCase):
    def test_stores_buy_sell_around_the_mid_rate(self):
        with patch("integrations.providers.currency.fetch_json", return_value=FX_OK):
            updated = currency.sync()

        self.assertEqual(updated, 6)
        usd = Currency.objects.get(code="USD")
        # 1/0.0205 ≈ 48.78 EGP per dollar
        self.assertAlmostEqual(float(usd.sell), 48.78 * 1.0035, delta=0.2)
        self.assertLess(usd.buy, usd.sell, "bank buy must sit below sell")

    def test_records_a_sparkline_point_per_run(self):
        with patch("integrations.providers.currency.fetch_json", return_value=FX_OK):
            currency.sync()
            currency.sync()

        self.assertEqual(len(Currency.objects.get(code="USD").series), 2)

    def test_computes_direction_from_the_previous_reading(self):
        with patch("integrations.providers.currency.fetch_json", return_value=FX_OK):
            currency.sync()
        weaker = {"rates": dict(FX_OK["rates"], USD=0.0195)}  # fewer dollars per pound → dollar up
        with patch("integrations.providers.currency.fetch_json", return_value=weaker):
            currency.sync()

        usd = Currency.objects.get(code="USD")
        self.assertTrue(usd.is_up)
        self.assertGreater(usd.change_pct, 0)

    def test_raises_when_the_payload_has_no_rates(self):
        with patch("integrations.providers.currency.fetch_json", return_value={"error": "bad key"}):
            with self.assertRaises(ProviderError):
                currency.sync()

    def test_raises_when_the_host_is_unreachable(self):
        with patch("integrations.providers.currency.fetch_json", return_value=None):
            with self.assertRaises(ProviderError):
                currency.sync()

    def test_a_failed_run_leaves_existing_prices_untouched(self):
        """The whole point of the design: a dead feed must not blank the bar."""
        with patch("integrations.providers.currency.fetch_json", return_value=FX_OK):
            currency.sync()
        before = float(Currency.objects.get(code="USD").sell)

        with patch("integrations.providers.currency.fetch_json", return_value=None):
            with self.assertRaises(ProviderError):
                currency.sync()

        self.assertEqual(float(Currency.objects.get(code="USD").sell), before)
        self.assertEqual(Currency.objects.count(), 6)

    def test_skips_a_single_malformed_rate_but_keeps_the_rest(self):
        with patch("integrations.providers.currency.fetch_json", return_value={"rates": dict(FX_OK["rates"], EUR="n/a")}):
            updated = currency.sync()

        self.assertEqual(updated, 5)
        self.assertFalse(Currency.objects.filter(code="EUR").exists())

    def test_ignores_a_zero_rate_rather_than_dividing_by_it(self):
        with patch("integrations.providers.currency.fetch_json", return_value={"rates": {"USD": 0}}):
            with self.assertRaises(ProviderError):
                currency.sync()


# ---------------------------------------------------------------------- gold
class GoldProviderTests(TestCase):
    def setUp(self):
        Currency.objects.create(code="USD", buy=48.5, sell=48.85, order=1)

    def test_converts_spot_ounce_to_egp_per_gram_by_karat(self):
        with patch("integrations.providers.gold.fetch_json", return_value={"price": 2400.0}):
            updated = gold.sync()

        self.assertEqual(updated, 4)  # 24k, 21k, 18k + جنيه ذهب
        gram_24 = (2400.0 / 31.1034768) * 48.85
        self.assertAlmostEqual(float(GoldKarat.objects.get(label="عيار 24").price), round(gram_24, 2), delta=0.5)
        self.assertAlmostEqual(
            float(GoldKarat.objects.get(label="عيار 21").price), round(gram_24 * 21 / 24, 2), delta=0.5
        )

    def test_gold_pound_is_eight_grams_of_21k(self):
        """جنيه ذهب is an Egyptian retail unit, not a karat row."""
        with patch("integrations.providers.gold.fetch_json", return_value={"price": 2400.0}):
            gold.sync()

        k21 = float(GoldKarat.objects.get(label="عيار 21").price)
        self.assertAlmostEqual(float(GoldKarat.objects.get(label="جنيه ذهب").price), round(k21 * 8, 2), delta=0.5)

    def test_karats_are_ordered_high_to_low(self):
        with patch("integrations.providers.gold.fetch_json", return_value={"price": 2400.0}):
            gold.sync()

        self.assertEqual(
            [g.label for g in GoldKarat.objects.all()],
            ["عيار 24", "عيار 21", "عيار 18", "جنيه ذهب"],
        )

    def test_refuses_to_run_without_a_dollar_rate(self):
        """Gold is quoted in USD; without USD/EGP the output would be garbage."""
        Currency.objects.all().delete()

        with patch.dict("os.environ", {}, clear=True):
            with patch("integrations.providers.gold.fetch_json", return_value={"price": 2400.0}):
                with self.assertRaises(ProviderError):
                    gold.sync()

    def test_rejects_a_nonsense_spot_price(self):
        with patch("integrations.providers.gold.fetch_json", return_value={"price": 0}):
            with self.assertRaises(ProviderError):
                gold.sync()

    def test_rejects_a_non_numeric_spot_price(self):
        with patch("integrations.providers.gold.fetch_json", return_value={"price": "unavailable"}):
            with self.assertRaises(ProviderError):
                gold.sync()

    def test_a_failed_run_leaves_existing_gold_prices_untouched(self):
        with patch("integrations.providers.gold.fetch_json", return_value={"price": 2400.0}):
            gold.sync()
        before = float(GoldKarat.objects.get(label="عيار 21").price)

        with patch("integrations.providers.gold.fetch_json", return_value=None):
            with self.assertRaises(ProviderError):
                gold.sync()

        self.assertEqual(float(GoldKarat.objects.get(label="عيار 21").price), before)


# ------------------------------------------------------------------- weather
OWM_OK = {
    "main": {"temp": 34.2, "temp_max": 36.1, "temp_min": 24.4, "humidity": 32},
    "weather": [{"id": 800, "icon": "01d"}],
}


class WeatherProviderTests(TestCase):
    def setUp(self):
        self.env = patch.dict("os.environ", {"OPENWEATHER_API_KEY": "test-key"})
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_stores_all_four_cities_rounded(self):
        with patch("integrations.providers.weather.fetch_json", return_value=OWM_OK):
            updated = weather.sync()

        self.assertEqual(updated, 4)
        cairo = WeatherCity.objects.get(key="cairo")
        self.assertEqual(cairo.label, "القاهرة")
        self.assertEqual(cairo.temp, 34)
        self.assertEqual(cairo.hi, 36)
        self.assertEqual(cairo.humidity, 32)

    def test_maps_condition_codes_to_icons(self):
        self.assertEqual(weather._icon_for(800, "01d"), "☀️")
        self.assertEqual(weather._icon_for(800, "01n"), "🌙")
        self.assertEqual(weather._icon_for(802, "03d"), "⛅")
        self.assertEqual(weather._icon_for(804, "04d"), "☁️")
        self.assertEqual(weather._icon_for(212, "11d"), "⛈️")
        self.assertEqual(weather._icon_for(502, "10d"), "🌧️")
        self.assertEqual(weather._icon_for(601, "13d"), "❄️")

    def test_unknown_condition_code_falls_back_rather_than_blanking(self):
        self.assertEqual(weather._icon_for(999, ""), "☀️")

    def test_raises_when_the_key_is_missing(self):
        with patch.dict("os.environ", {}, clear=True):
            with override_settings(OPENWEATHER_API_KEY=""):
                with self.assertRaises(ProviderError):
                    weather.sync()

    def test_partial_success_still_counts(self):
        """Three cities refreshed beats discarding all four over one blip."""
        with patch("integrations.providers.weather.fetch_json", side_effect=[OWM_OK, None, OWM_OK, OWM_OK]):
            updated = weather.sync()

        self.assertEqual(updated, 3)

    def test_raises_only_when_every_city_fails(self):
        with patch("integrations.providers.weather.fetch_json", return_value=None):
            with self.assertRaises(ProviderError):
                weather.sync()


# -------------------------------------------------------------------- prayer
ALADHAN_OK = {
    "code": 200,
    "data": {
        "timings": {
            "Fajr": "03:29 (EEST)", "Dhuhr": "12:59 (EEST)", "Asr": "16:36 (EEST)",
            "Maghrib": "19:47 (EEST)", "Isha": "21:15 (EEST)",
        },
        "date": {"hijri": {"day": "11", "month": {"number": 2, "ar": "صفر"}, "year": "1448"}},
    },
}


class PrayerProviderTests(TestCase):
    def test_stores_timings_stripped_of_the_timezone_note(self):
        with patch("integrations.providers.prayer.fetch_json", return_value=ALADHAN_OK):
            updated = prayer.sync()

        self.assertEqual(updated, 4)
        row = PrayerTimes.objects.get(city_key="cairo", date=timezone.localdate())
        self.assertEqual(row.fajr, "03:29")
        self.assertEqual(row.maghrib, "19:47")

    def test_builds_an_arabic_hijri_label(self):
        with patch("integrations.providers.prayer.fetch_json", return_value=ALADHAN_OK):
            prayer.sync()

        self.assertEqual(PrayerTimes.objects.filter(city_key="cairo").first().hijri_date, "11 صفر 1448")

    def test_raises_on_an_error_code_in_the_body(self):
        with patch("integrations.providers.prayer.fetch_json", return_value={"code": 400, "data": "bad"}):
            with self.assertRaises(ProviderError):
                prayer.sync()

    def test_prunes_previous_days(self):
        """The header only ever reads today; old rows are dead weight."""
        PrayerTimes.objects.create(city_key="cairo", date=date(2020, 1, 1), fajr="05:00")

        with patch("integrations.providers.prayer.fetch_json", return_value=ALADHAN_OK):
            prayer.sync()

        self.assertFalse(PrayerTimes.objects.filter(date=date(2020, 1, 1)).exists())

    def test_rerunning_the_same_day_updates_rather_than_duplicates(self):
        with patch("integrations.providers.prayer.fetch_json", return_value=ALADHAN_OK):
            prayer.sync()
            prayer.sync()

        self.assertEqual(PrayerTimes.objects.filter(city_key="cairo").count(), 1)


# ------------------------------------------------------------------ football
SPORTSDB_PAST = {
    "events": [
        {
            "idEvent": "2001", "strHomeTeam": "الأهلي", "strAwayTeam": "الزمالك",
            "intHomeScore": "2", "intAwayScore": "1", "dateEvent": "2026-07-20",
            "strTime": "19:00:00", "intRound": "3", "strVenue": "استاد القاهرة",
            "strLeague": "الدوري المصري الممتاز",
        }
    ]
}
SPORTSDB_NEXT = {
    "events": [
        {
            "idEvent": "2002", "strHomeTeam": "بيراميدز", "strAwayTeam": "المصري",
            "intHomeScore": None, "intAwayScore": None, "dateEvent": "2026-08-02",
            "strTime": "21:00:00", "intRound": "4", "strVenue": "استاد السلام",
        }
    ]
}


class FootballProviderTests(TestCase):
    def test_stores_results_and_fixtures(self):
        with patch("integrations.providers.football.fetch_json", side_effect=[SPORTSDB_PAST, SPORTSDB_NEXT]):
            stored = football.sync()

        self.assertEqual(stored, 2)
        played = Match.objects.get(external_id="2001")
        self.assertEqual(played.status, Match.Status.FINISHED)
        self.assertEqual(played.score_label, "2 - 1")
        self.assertEqual(played.round_label, "الجولة 3")

        upcoming = Match.objects.get(external_id="2002")
        self.assertEqual(upcoming.status, Match.Status.SCHEDULED)

    def test_unplayed_match_shows_a_dash_not_a_goalless_draw(self):
        with patch("integrations.providers.football.fetch_json", side_effect=[{"events": []}, SPORTSDB_NEXT]):
            football.sync()

        self.assertEqual(Match.objects.get(external_id="2002").score_label, "—")

    def test_a_past_event_with_no_score_is_not_called_finished(self):
        """Postponed fixtures come back in the 'past' feed without a score."""
        postponed = {"events": [dict(SPORTSDB_PAST["events"][0], intHomeScore=None, intAwayScore=None)]}
        with patch("integrations.providers.football.fetch_json", side_effect=[postponed, {"events": []}]):
            football.sync()

        self.assertEqual(Match.objects.get(external_id="2001").status, Match.Status.SCHEDULED)

    def test_skips_events_missing_a_team(self):
        broken = {"events": [{"idEvent": "9", "strHomeTeam": "الأهلي"}]}
        with patch("integrations.providers.football.fetch_json", side_effect=[broken, {"events": []}]):
            stored = football.sync()

        self.assertEqual(stored, 0)
        self.assertFalse(Match.objects.exists())

    def test_an_empty_off_season_response_is_not_a_failure(self):
        with patch("integrations.providers.football.fetch_json", side_effect=[{"events": []}, {"events": []}]):
            self.assertEqual(football.sync(), 0)

    def test_raises_only_when_both_endpoints_are_unreachable(self):
        with patch("integrations.providers.football.fetch_json", side_effect=[None, None]):
            with self.assertRaises(ProviderError):
                football.sync()

    def test_rerunning_updates_the_score_in_place(self):
        with patch("integrations.providers.football.fetch_json", side_effect=[SPORTSDB_PAST, {"events": []}]):
            football.sync()
        later = {"events": [dict(SPORTSDB_PAST["events"][0], intHomeScore="3")]}
        with patch("integrations.providers.football.fetch_json", side_effect=[later, {"events": []}]):
            football.sync()

        self.assertEqual(Match.objects.count(), 1)
        self.assertEqual(Match.objects.get(external_id="2001").home_score, 3)


# ------------------------------------------------------------------ newswire
NEWSDATA_OK = {
    "status": "success",
    "results": [
        {
            "article_id": "abc123", "title": "عنوان من الوكالة", "description": "ملخص",
            "link": "https://example.com/a", "image_url": "https://example.com/a.jpg",
            "source_name": "وكالة", "language": "arabic", "pubDate": "2026-07-26 10:00:00",
        }
    ],
}


class NewswireProviderTests(TestCase):
    def setUp(self):
        self.env = patch.dict("os.environ", {"NEWSDATA_API_KEY": "test-key"})
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_stores_wire_items(self):
        with patch("integrations.providers.newswire.fetch_json", return_value=NEWSDATA_OK):
            stored = newswire.sync()

        self.assertEqual(stored, 1)
        item = WireArticle.objects.get(external_id="abc123")
        self.assertEqual(item.title, "عنوان من الوكالة")
        self.assertEqual(item.source_name, "وكالة")
        self.assertIsNotNone(item.published_at)

    def test_skips_items_with_no_title_or_link(self):
        """They'd render as an empty card that goes nowhere."""
        broken = {
            "status": "success",
            "results": [
                {"article_id": "x", "title": "", "link": "https://e.test"},
                {"article_id": "y", "title": "عنوان", "link": ""},
            ],
        }
        with patch("integrations.providers.newswire.fetch_json", return_value=broken):
            with self.assertRaises(ProviderError):
                newswire.sync()

        self.assertFalse(WireArticle.objects.exists())

    def test_raises_when_the_key_is_missing(self):
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(ProviderError):
                newswire.sync()

    def test_raises_on_an_error_status_in_the_body(self):
        with patch("integrations.providers.newswire.fetch_json", return_value={"status": "error", "message": "quota"}):
            with self.assertRaises(ProviderError):
                newswire.sync()

    def test_rerunning_updates_rather_than_duplicating(self):
        with patch("integrations.providers.newswire.fetch_json", return_value=NEWSDATA_OK):
            newswire.sync()
            newswire.sync()

        self.assertEqual(WireArticle.objects.count(), 1)

    def test_trims_the_table_so_it_cannot_grow_forever(self):
        for i in range(70):
            WireArticle.objects.create(
                external_id=f"old-{i}", title=f"قديم {i}", url="https://e.test", provider="newsdata"
            )

        with patch("integrations.providers.newswire.fetch_json", return_value=NEWSDATA_OK):
            newswire.sync()

        self.assertLessEqual(WireArticle.objects.count(), newswire.MAX_STORED)


# ------------------------------------------------------------------ sync log
class SyncLogTests(TestCase):
    def test_success_clears_the_failure_streak(self):
        SyncLog.record_failure("currency", "العملات", "down")
        SyncLog.record_failure("currency", "العملات", "down")
        self.assertEqual(SyncLog.objects.get(source="currency").consecutive_failures, 2)

        SyncLog.record_success("currency", "العملات", records=6)

        log = SyncLog.objects.get(source="currency")
        self.assertEqual(log.consecutive_failures, 0)
        self.assertEqual(log.status, SyncLog.Status.OK)

    def test_failure_preserves_the_last_success_time(self):
        """That timestamp is how we know how old the data on screen is."""
        SyncLog.record_success("gold", "الذهب", records=4)
        succeeded_at = SyncLog.objects.get(source="gold").last_success_at

        SyncLog.record_failure("gold", "الذهب", "unreachable")

        log = SyncLog.objects.get(source="gold")
        self.assertEqual(log.last_success_at, succeeded_at)
        self.assertEqual(log.status, SyncLog.Status.FAILED)

    def test_failure_keeps_the_previous_record_count(self):
        SyncLog.record_success("gold", "الذهب", records=4)
        SyncLog.record_failure("gold", "الذهب", "unreachable")

        self.assertEqual(SyncLog.objects.get(source="gold").records, 4)

    def test_never_succeeded_counts_as_stale(self):
        log = SyncLog.record_failure("weather", "الطقس", "no key")

        self.assertTrue(log.is_stale)

    def test_fresh_success_is_not_stale(self):
        log = SyncLog.record_success("weather", "الطقس", records=4)

        self.assertFalse(log.is_stale)

    def test_one_row_per_source(self):
        SyncLog.record_success("currency", "العملات")
        SyncLog.record_failure("currency", "العملات", "x")
        SyncLog.record_success("currency", "العملات")

        self.assertEqual(SyncLog.objects.filter(source="currency").count(), 1)


# -------------------------------------------------------------- sync command
class SyncFeedsCommandTests(TestCase):
    def test_one_broken_source_does_not_stop_the_others(self):
        with patch("integrations.providers.currency.sync", return_value=6), \
             patch("integrations.providers.gold.sync", side_effect=ProviderError("boom")), \
             patch("integrations.providers.weather.sync", return_value=4), \
             patch("integrations.providers.prayer.sync", return_value=4), \
             patch("integrations.providers.football.sync", return_value=2), \
             patch("integrations.providers.newswire.sync", return_value=10):
            call_command("sync_feeds")

        self.assertEqual(SyncLog.objects.get(source="currency").status, SyncLog.Status.OK)
        self.assertEqual(SyncLog.objects.get(source="gold").status, SyncLog.Status.FAILED)
        self.assertEqual(SyncLog.objects.get(source="weather").status, SyncLog.Status.OK)

    def test_an_unexpected_exception_is_contained(self):
        """A cron has to survive anything a third party throws at it."""
        with patch("integrations.providers.currency.sync", side_effect=KeyError("unexpected shape")), \
             patch("integrations.providers.gold.sync", return_value=4), \
             patch("integrations.providers.weather.sync", return_value=4), \
             patch("integrations.providers.prayer.sync", return_value=4), \
             patch("integrations.providers.football.sync", return_value=0), \
             patch("integrations.providers.newswire.sync", return_value=0):
            call_command("sync_feeds")

        log = SyncLog.objects.get(source="currency")
        self.assertEqual(log.status, SyncLog.Status.FAILED)
        self.assertIn("KeyError", log.message)

    def test_only_runs_the_named_sources(self):
        with patch("integrations.providers.currency.sync", return_value=6) as fx, \
             patch("integrations.providers.newswire.sync", return_value=10) as wire:
            call_command("sync_feeds", only="currency")

        fx.assert_called_once()
        wire.assert_not_called()

    def test_skip_excludes_a_source(self):
        with patch("integrations.providers.currency.sync", return_value=6), \
             patch("integrations.providers.gold.sync", return_value=4), \
             patch("integrations.providers.weather.sync", return_value=4), \
             patch("integrations.providers.prayer.sync", return_value=4), \
             patch("integrations.providers.football.sync", return_value=0), \
             patch("integrations.providers.newswire.sync", return_value=10) as wire:
            call_command("sync_feeds", skip="newswire")

        wire.assert_not_called()

    def test_unknown_source_is_rejected_without_running_anything(self):
        with patch("integrations.providers.currency.sync", return_value=6) as fx:
            call_command("sync_feeds", only="nope")

        fx.assert_not_called()

    def test_currency_runs_before_gold(self):
        """Gold reads USD/EGP out of the currency table, so the order in the
        registry is load-bearing, not cosmetic."""
        from integrations.providers import PROVIDERS

        keys = [p.SOURCE for p in PROVIDERS]
        self.assertLess(keys.index("currency"), keys.index("gold"))


# -------------------------------------------------------------- API endpoints
class IntegrationsAPITests(APITestCase):
    def test_prayer_times_endpoint_returns_todays_row(self):
        PrayerTimes.objects.create(
            city_key="cairo", date=timezone.localdate(), hijri_date="11 صفر 1448", fajr="03:29", maghrib="19:47"
        )

        res = self.client.get("/api/prayer-times/?city=cairo")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["fajr"], "03:29")
        self.assertEqual(res.json()["hijri_date"], "11 صفر 1448")

    def test_prayer_times_falls_back_to_the_most_recent_day(self):
        """A missed sync shouldn't blank the header."""
        PrayerTimes.objects.create(city_key="cairo", date=date(2026, 7, 20), fajr="03:20")

        res = self.client.get("/api/prayer-times/?city=cairo")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["fajr"], "03:20")

    def test_prayer_times_returns_null_when_nothing_is_stored(self):
        res = self.client.get("/api/prayer-times/?city=cairo")

        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.json())

    def test_matches_endpoint_filters_by_status(self):
        Match.objects.create(external_id="1", home_team="أ", away_team="ب", status=Match.Status.FINISHED)
        Match.objects.create(external_id="2", home_team="ج", away_team="د", status=Match.Status.SCHEDULED)

        res = self.client.get("/api/matches/?status=finished")

        self.assertEqual(res.json()["count"], 1)

    def test_matches_expose_the_score_label(self):
        Match.objects.create(external_id="1", home_team="أ", away_team="ب", home_score=2, away_score=1)

        res = self.client.get("/api/matches/")

        self.assertEqual(res.json()["results"][0]["score_label"], "2 - 1")

    def test_wire_endpoint_is_read_only(self):
        """Wire copy is mirrored, not authored — POST must not be allowed."""
        res = self.client.post("/api/wire/", {"title": "x", "url": "https://e.test"}, format="json")

        self.assertEqual(res.status_code, 405)

    def test_sync_logs_expose_staleness_to_the_dashboard(self):
        SyncLog.record_success("currency", "العملات", records=6)

        res = self.client.get("/api/sync-logs/")
        row = res.json()["results"][0]

        self.assertEqual(row["source"], "currency")
        self.assertFalse(row["is_stale"])
        self.assertEqual(row["records"], 6)


OPEN_METEO_OK = {
    "current": {"temperature_2m": 34.4, "relative_humidity_2m": 32, "weather_code": 0, "is_day": 1},
    "daily": {"temperature_2m_max": [36.2], "temperature_2m_min": [24.1]},
}


class WeatherBackendSelectionTests(TestCase):
    """The keyless backend exists so a fresh clone shows real weather, but it
    is licensed non-commercially — so it must never be selected implicitly."""

    def test_open_meteo_backend_needs_no_key(self):
        with patch.dict("os.environ", {"WEATHER_PROVIDER": "open-meteo"}, clear=True):
            with patch("integrations.providers.weather.fetch_json", return_value=OPEN_METEO_OK):
                updated = weather.sync()

        self.assertEqual(updated, 4)
        cairo = WeatherCity.objects.get(key="cairo")
        self.assertEqual(cairo.temp, 34)
        self.assertEqual(cairo.hi, 36)
        self.assertEqual(cairo.lo, 24)
        self.assertEqual(cairo.humidity, 32)

    def test_missing_key_does_not_silently_fall_back_to_open_meteo(self):
        """Falling back on its own would quietly put a commercial site on a
        non-commercial licence."""
        with patch.dict("os.environ", {}, clear=True):
            with override_settings(OPENWEATHER_API_KEY=""):
                with patch("integrations.providers.weather.fetch_json", return_value=OPEN_METEO_OK):
                    with self.assertRaises(ProviderError):
                        weather.sync()

        self.assertFalse(WeatherCity.objects.exists())

    def test_the_error_names_the_keyless_alternative(self):
        with patch.dict("os.environ", {}, clear=True):
            with override_settings(OPENWEATHER_API_KEY=""):
                with self.assertRaises(ProviderError) as ctx:
                    weather.sync()

        self.assertIn("open-meteo", str(ctx.exception))

    def test_both_backends_produce_the_same_icon_for_clear_sky(self):
        self.assertEqual(weather._icon_for(800, "01d"), weather._icon_for_wmo(0, 1))
        self.assertEqual(weather._icon_for(800, "01n"), weather._icon_for_wmo(0, 0))

    def test_wmo_codes_map_across_the_documented_groups(self):
        self.assertEqual(weather._icon_for_wmo(2), "⛅")
        self.assertEqual(weather._icon_for_wmo(3), "☁️")
        self.assertEqual(weather._icon_for_wmo(48), "🌫️")
        self.assertEqual(weather._icon_for_wmo(61), "🌧️")
        self.assertEqual(weather._icon_for_wmo(73), "❄️")
        self.assertEqual(weather._icon_for_wmo(95), "⛈️")

    def test_open_meteo_survives_a_missing_daily_block(self):
        """Without the daily forecast, hi/lo fall back to the current temp
        rather than writing zeros into the ticker."""
        with patch.dict("os.environ", {"WEATHER_PROVIDER": "open-meteo"}, clear=True):
            with patch("integrations.providers.weather.fetch_json", return_value={"current": OPEN_METEO_OK["current"]}):
                weather.sync()

        cairo = WeatherCity.objects.get(key="cairo")
        self.assertEqual(cairo.hi, 34)
        self.assertEqual(cairo.lo, 34)
