"""
Who may read ad placements.

Impressions, clicks and the CTR derived from them are commercial figures. No
reader-facing page renders them, so unlike currencies, weather or prayer times
there is nothing to trade away by closing the endpoint — and a competitor
reading a newspaper's fill rate and click-through off a public URL is a
straightforward business leak, not a theoretical one.

These sit apart from tests.py, which is about the CTR arithmetic: this file is
about the door.
"""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from ads.models import AdPlacement

User = get_user_model()


class AdPlacementPermissionTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.placement = AdPlacement.objects.create(
            name="أعلى الهيدر", size="728×90", impressions=128400, clicks=612
        )
        cls.staff = User.objects.create_user(username="editor", password="pw", is_staff=True, role="editor")
        cls.reader = User.objects.create_user(username="reader", password="pw")

    def test_anonymous_cannot_list_placements(self):
        res = self.client.get("/api/ads/")

        self.assertEqual(res.status_code, 403)

    def test_anonymous_cannot_read_one_placement(self):
        res = self.client.get(f"/api/ads/{self.placement.pk}/")

        self.assertEqual(res.status_code, 403)

    def test_a_signed_in_reader_is_still_not_newsroom_staff(self):
        self.client.force_authenticate(self.reader)

        res = self.client.get("/api/ads/")

        self.assertEqual(res.status_code, 403)

    def test_no_response_body_carries_the_figures_to_a_reader(self):
        """
        Belt and braces: assert on the bytes, not just the status. A 403 whose
        body still echoed the row would leak exactly what the status refused.
        """
        self.client.force_authenticate(self.reader)

        body = self.client.get("/api/ads/").content.decode()

        self.assertNotIn("128400", body)
        self.assertNotIn("أعلى الهيدر", body)

    def test_staff_see_the_placements_and_the_derived_ctr(self):
        self.client.force_authenticate(self.staff)

        res = self.client.get("/api/ads/")
        row = res.json()["results"][0]

        self.assertEqual(res.status_code, 200)
        self.assertEqual(row["impressions"], 128400)
        self.assertEqual(row["ctr"], 0.48)

    def test_anonymous_cannot_create_edit_or_delete(self):
        for method, path, payload in (
            ("post", "/api/ads/", {"name": "جديد", "size": "300×250"}),
            ("patch", f"/api/ads/{self.placement.pk}/", {"clicks": 999999}),
            ("delete", f"/api/ads/{self.placement.pk}/", {}),
        ):
            with self.subTest(method=method):
                res = getattr(self.client, method)(path, payload, format="json")

                self.assertEqual(res.status_code, 403)

        self.placement.refresh_from_db()
        self.assertEqual(AdPlacement.objects.count(), 1)
        self.assertEqual(self.placement.clicks, 612)
