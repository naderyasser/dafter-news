"""
The visit beacon — the writer DailyVisit never had.

Until now the only thing that ever wrote a row was the demo seed, so the
overview's headline number was fiction. The beacon is unauthenticated by
design (an editor browsing the public site must count too, and Session auth
would CSRF-fail them into silence), so these also pin what the endpoint does
NOT do: no reads, no echo, nothing an anonymous caller can learn from it.
"""
import datetime

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from siteconfig.models import DailyVisit

User = get_user_model()


class VisitTrackTests(APITestCase):
    def setUp(self):
        # ScopedRateThrottle keeps its counters in the cache; a previous
        # test's hits must not eat this test's budget.
        cache.clear()

    def test_first_visit_of_the_day_creates_the_row(self):
        res = self.client.post("/api/visits/track/")

        self.assertEqual(res.status_code, 204)
        row = DailyVisit.objects.get(date=timezone.localdate())
        self.assertEqual(row.visits, 1)

    def test_visits_accumulate(self):
        for _ in range(3):
            self.client.post("/api/visits/track/")

        self.assertEqual(DailyVisit.objects.get(date=timezone.localdate()).visits, 3)

    def test_an_existing_seeded_row_is_incremented_not_replaced(self):
        DailyVisit.objects.create(date=timezone.localdate(), visits=48204, change_pct=4.2)

        self.client.post("/api/visits/track/")

        self.assertEqual(DailyVisit.objects.get(date=timezone.localdate()).visits, 48205)

    def test_the_beacon_answers_nothing(self):
        res = self.client.post("/api/visits/track/")

        self.assertEqual(res.content, b"")

    def test_get_is_not_an_accidental_public_stats_api(self):
        res = self.client.get("/api/visits/track/")

        self.assertEqual(res.status_code, 405)

    def test_the_daily_visits_table_itself_is_newsroom_only_now(self):
        """The counter being real is exactly why the raw table went
        StaffOnly: it is the audience curve, same class as the ad figures."""
        DailyVisit.objects.create(date=timezone.localdate(), visits=10)

        self.assertEqual(self.client.get("/api/daily-visits/").status_code, 403)

        self.client.force_authenticate(User.objects.create_user(username="ed", password="pw", is_staff=True))
        self.assertEqual(self.client.get("/api/daily-visits/").status_code, 200)


class OverviewChangePctTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(User.objects.create_user(username="ov", password="pw", is_staff=True))
        self.today = timezone.localdate()

    def test_change_is_computed_from_yesterday_when_it_exists(self):
        DailyVisit.objects.create(date=self.today, visits=150, change_pct=4.2)
        DailyVisit.objects.create(date=self.today - datetime.timedelta(days=1), visits=100)

        stats = self.client.get("/api/dashboard/overview/").json()["stats"]

        # 100 → 150 is +50%, whatever the stale stored column says.
        self.assertEqual(float(stats["visits_change_pct"]), 50.0)

    def test_stored_value_survives_as_the_day_one_fallback(self):
        DailyVisit.objects.create(date=self.today, visits=150, change_pct=4.2)

        stats = self.client.get("/api/dashboard/overview/").json()["stats"]

        self.assertEqual(float(stats["visits_change_pct"]), 4.2)

    def test_a_down_day_reads_negative(self):
        DailyVisit.objects.create(date=self.today, visits=60)
        DailyVisit.objects.create(date=self.today - datetime.timedelta(days=1), visits=100)

        stats = self.client.get("/api/dashboard/overview/").json()["stats"]

        self.assertEqual(float(stats["visits_change_pct"]), -40.0)
