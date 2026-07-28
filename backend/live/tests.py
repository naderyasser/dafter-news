"""Tests for the live stream and its «التغطية لحظة بلحظة» timeline."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase

from live.models import LiveStream, LiveUpdate

User = get_user_model()


class LiveModelTests(TestCase):
    def test_updates_are_newest_first(self):
        """The timeline reads top-down newest-first, matching Live.dc.html."""
        stream = LiveStream.objects.create(title="مؤتمر البنك المركزي", is_live=True)
        LiveUpdate.objects.create(stream=stream, time_label="12:20", text="قديم")
        LiveUpdate.objects.create(stream=stream, time_label="12:41", text="جديد")

        self.assertEqual([u.text for u in stream.updates.all()], ["جديد", "قديم"])

    def test_deleting_stream_removes_its_updates(self):
        stream = LiveStream.objects.create(title="بث")
        LiveUpdate.objects.create(stream=stream, time_label="10:00", text="تحديث")

        stream.delete()

        self.assertEqual(LiveUpdate.objects.count(), 0)


class LiveAPITests(APITestCase):
    def setUp(self):
        self.stream = LiveStream.objects.create(title="تغطية لحظية: مؤتمر البنك المركزي", is_live=True)
        LiveUpdate.objects.create(stream=self.stream, time_label="12:41", text="محافظ البنك يبدأ كلمته")
        self.staff = User.objects.create(username="live-staff", is_staff=True)
        self.client.force_authenticate(self.staff)

    def test_list_embeds_updates(self):
        res = self.client.get("/api/live-streams/")
        row = res.json()["results"][0]

        self.assertTrue(row["is_live"])
        self.assertEqual(len(row["updates"]), 1)
        self.assertEqual(row["updates"][0]["time_label"], "12:41")

    def test_toggle_live_state(self):
        res = self.client.patch(f"/api/live-streams/{self.stream.pk}/", {"is_live": False}, format="json")

        self.assertEqual(res.status_code, 200)
        self.stream.refresh_from_db()
        self.assertFalse(self.stream.is_live)

    def test_publish_a_timeline_update(self):
        res = self.client.post(
            "/api/live-updates/",
            {"stream": self.stream.pk, "time_label": "13:05", "text": "تحديث جديد"},
            format="json",
        )

        self.assertEqual(res.status_code, 201)
        self.assertEqual(self.stream.updates.count(), 2)

    def test_delete_a_timeline_update(self):
        update = self.stream.updates.first()

        res = self.client.delete(f"/api/live-updates/{update.pk}/")

        self.assertEqual(res.status_code, 204)
        self.assertEqual(self.stream.updates.count(), 0)

    def test_updates_can_be_filtered_by_stream(self):
        other = LiveStream.objects.create(title="بث آخر")
        LiveUpdate.objects.create(stream=other, time_label="09:00", text="غير ذي صلة")

        res = self.client.get(f"/api/live-updates/?stream={self.stream.pk}")

        self.assertEqual(res.json()["count"], 1)
