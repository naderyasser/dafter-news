"""
Feed health on the overview — the alarm that was missing.

newswire and weather shipped broken and climbed past four thousand
consecutive failures with nobody told; the SyncLog rows recorded everything
and surfaced nowhere the owner actually looks. The overview is the screen
every dashboard session opens on, so that is where a dead feed announces
itself.
"""
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from integrations.models import SyncLog

User = get_user_model()


class FeedAlertTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(User.objects.create_user(username="fa", password="pw", is_staff=True))

    def log(self, source, status, fails, label=None):
        return SyncLog.objects.create(
            source=source,
            label=label or source,
            status=status,
            consecutive_failures=fails,
            message="مفتاح مفقود" if status == SyncLog.Status.FAILED else "",
            last_attempt_at=timezone.now(),
        )

    def test_a_dead_feed_is_announced(self):
        self.log("newswire", SyncLog.Status.FAILED, 4200, label="الأخبار الخارجية")

        alerts = self.client.get("/api/dashboard/overview/").json()["feed_alerts"]

        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["label"], "الأخبار الخارجية")
        self.assertEqual(alerts[0]["consecutive_failures"], 4200)
        self.assertEqual(alerts[0]["message"], "مفتاح مفقود")

    def test_a_blip_is_not_an_alarm(self):
        """Two misses on a minutely cron is two minutes — the third is when
        it stops being weather."""
        self.log("gold", SyncLog.Status.FAILED, 2)

        alerts = self.client.get("/api/dashboard/overview/").json()["feed_alerts"]

        self.assertEqual(alerts, [])

    def test_healthy_feeds_stay_out_of_it(self):
        self.log("prayer", SyncLog.Status.OK, 0)
        self.log("currency", SyncLog.Status.OK, 0)

        alerts = self.client.get("/api/dashboard/overview/").json()["feed_alerts"]

        self.assertEqual(alerts, [])

    def test_a_recovered_feed_stops_alarming_even_with_an_ugly_history(self):
        """status=ok with a high stale failure count (the counter resets on
        success, but belt-and-braces against a partial write)."""
        self.log("weather", SyncLog.Status.OK, 4146)

        alerts = self.client.get("/api/dashboard/overview/").json()["feed_alerts"]

        self.assertEqual(alerts, [])

    def test_worst_first(self):
        self.log("newswire", SyncLog.Status.FAILED, 4200)
        self.log("football", SyncLog.Status.FAILED, 7)

        alerts = self.client.get("/api/dashboard/overview/").json()["feed_alerts"]

        self.assertEqual([a["source"] for a in alerts], ["newswire", "football"])
