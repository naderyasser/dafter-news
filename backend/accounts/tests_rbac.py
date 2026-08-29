"""
What a كاتب (Writer) can and cannot do, end to end through the API.

The client's brief, as a test: a writer files and publishes stories and picks
which section they belong to, and touches nothing else — not the settings,
not the SEO fields, not the user list, not the taxonomy those sections come
from.

Written as one matrix per role rather than per endpoint because the risk here
is a gap, not a wrong answer: it is the endpoint nobody thought to gate that
hands a new hire the site's settings. Every dashboard-writable resource in
the project appears in RESTRICTED below.
"""
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from ads.models import AdPlacement
from content.models import Article, BreakingNewsItem, Comment, Section, Story, Tag
from market.models import TickerModule
from video.models import Video

User = get_user_model()


def make(role, username, **extra):
    """An invited team member — is_staff, as /api/users/ creates them."""
    return User.objects.create_user(username=username, password="pw", is_staff=True, role=role, **extra)


class WriterCanDoTheJobTests(APITestCase):
    """The permitted half. A role locked down so hard it cannot file a story
    is not "secure", it is broken — and this is exactly what shipped: `author`
    accounts were created with is_staff=False and could do nothing at all."""

    def setUp(self):
        self.writer = make("author", "kateb")
        self.section = Section.objects.create(key="egypt", name_ar="شؤون مصر")
        self.client.force_authenticate(self.writer)

    def test_can_create_an_article_and_assign_it_to_a_section(self):
        res = self.client.post(
            "/api/articles/",
            {"title": "خبر من الكاتب", "section": self.section.id, "language": "ar", "status": "draft"},
            format="json",
        )

        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(Article.objects.get(pk=res.data["id"]).section_id, self.section.id)

    def test_can_edit_and_publish_their_article(self):
        article = Article.objects.create(title="مسودة", section=self.section)

        res = self.client.patch(f"/api/articles/{article.slug}/", {"status": "published"}, format="json")

        self.assertEqual(res.status_code, 200, res.data)
        article.refresh_from_db()
        self.assertEqual(article.status, "published")
        self.assertIsNotNone(article.published_at)

    def test_can_read_the_section_and_tag_lists_to_choose_from(self):
        # Assigning a section means reading the list; it does not mean editing it.
        self.assertEqual(self.client.get("/api/sections/").status_code, 200)
        self.assertEqual(self.client.get("/api/tags/").status_code, 200)

    def test_can_use_the_media_library_for_their_own_photos(self):
        self.assertEqual(self.client.get("/api/media/").status_code, 200)

    def test_can_open_the_dashboard_overview(self):
        self.assertEqual(self.client.get("/api/dashboard/overview/").status_code, 200)

    def test_can_import_a_story_from_a_url(self):
        # Not 403 — the import guard answers on the URL's own merits.
        self.assertNotEqual(self.client.post("/api/import-from-url/", {"url": ""}, format="json").status_code, 403)


class WriterIsLockedOutTests(APITestCase):
    """The forbidden half — the client's explicit list, plus every other
    dashboard-writable resource, so a gap shows up here rather than in
    production."""

    def setUp(self):
        self.writer = make("author", "kateb2")
        self.section = Section.objects.create(key="egypt", name_ar="شؤون مصر")
        self.tag = Tag.objects.create(name="الذهب", slug="الذهب")
        self.client.force_authenticate(self.writer)

    def test_cannot_touch_site_settings_or_seo(self):
        res = self.client.put("/api/settings/", {"site_name": "اختراق", "seo_title": "x"}, format="json")

        self.assertEqual(res.status_code, 403)

    def test_cannot_reach_user_management(self):
        self.assertEqual(self.client.get("/api/users/").status_code, 403)
        self.assertEqual(
            self.client.post("/api/users/", {"username": "mine", "role": "admin"}, format="json").status_code, 403
        )

    def test_cannot_rename_or_delete_a_section(self):
        self.assertEqual(
            self.client.patch(f"/api/sections/{self.section.key}/", {"name_ar": "غيّرته"}, format="json").status_code, 403
        )
        self.assertEqual(self.client.delete(f"/api/sections/{self.section.key}/").status_code, 403)
        self.assertEqual(
            self.client.post("/api/sections/", {"key": "new", "name_ar": "قسم"}, format="json").status_code, 403
        )

    def test_cannot_edit_the_tag_vocabulary(self):
        self.assertEqual(self.client.delete(f"/api/tags/{self.tag.slug}/").status_code, 403)

    def test_cannot_change_the_social_links_in_every_footer(self):
        self.assertEqual(
            self.client.post("/api/social-links/", {"platform": "x", "url": "https://x.com/a"}, format="json").status_code,
            403,
        )

    def test_cannot_moderate_the_comment_queue(self):
        article = Article.objects.create(title="خبر", status=Article.Status.PUBLISHED, published_at=timezone.now())
        comment = Comment.objects.create(article=article, text="تعليق")

        self.assertEqual(self.client.get("/api/comments/").status_code, 403)
        self.assertEqual(
            self.client.patch(f"/api/comments/{comment.pk}/", {"status": "approved"}, format="json").status_code, 403
        )

    def test_cannot_run_the_other_desks(self):
        """Ads, the markets ticker, the video desk, the breaking strip, the
        stories rail and the site-wide welcome modal — every one of them is
        visible on a page a writer does not own."""
        video = Video.objects.create(title="فيديو")
        ad = AdPlacement.objects.create(name="بانر", size="728x90")
        module = TickerModule.objects.create(key="gold", label="الذهب")
        item = BreakingNewsItem.objects.create(text="عاجل")
        story = Story.objects.create(title="قصة")

        cases = [
            ("patch", f"/api/videos/{video.slug}/", {"title": "غيّرته"}),
            ("patch", f"/api/ads/{ad.pk}/", {"active": False}),
            ("patch", f"/api/ticker-modules/{module.pk}/", {"active": False}),
            ("patch", f"/api/breaking/{item.pk}/", {"text": "غيّرته"}),
            ("patch", f"/api/stories/{story.pk}/", {"title": "غيّرتها"}),
            ("put", "/api/welcome-alert/", {"title": "إعلان"}),
        ]
        for method, url, payload in cases:
            res = getattr(self.client, method)(url, payload, format="json")
            self.assertEqual(res.status_code, 403, f"{method.upper()} {url} returned {res.status_code}")

    def test_cannot_edit_the_paper_masthead(self):
        self.assertEqual(
            self.client.patch(f"/api/authors/{self.writer.username}/", {"bio": "x"}, format="json").status_code, 403
        )

    def test_a_refusal_says_what_is_missing(self):
        """An editor reading «هذا الإجراء يتطلب صلاحية محرر» knows to ask for
        a role; a bare 403 tells them nothing."""
        res = self.client.delete(f"/api/sections/{self.section.key}/")

        self.assertIn("صلاحية", str(res.data.get("detail", "")))


class EditorAndModeratorScopeTests(APITestCase):
    """The tiers above and beside the writer, so the ladder is asserted and
    not just the bottom rung."""

    def setUp(self):
        self.section = Section.objects.create(key="egypt", name_ar="شؤون مصر")

    def test_an_editor_runs_the_desks_but_not_the_settings(self):
        self.client.force_authenticate(make("editor", "muharrir"))

        self.assertEqual(
            self.client.patch(f"/api/sections/{self.section.key}/", {"name_ar": "مصر"}, format="json").status_code, 200
        )
        self.assertEqual(self.client.get("/api/comments/").status_code, 200)
        # ...and stops at the site's own identity and its accounts.
        self.assertEqual(self.client.put("/api/settings/", {"site_name": "x"}, format="json").status_code, 403)
        self.assertEqual(self.client.get("/api/users/").status_code, 403)

    def test_a_moderator_works_the_queue_and_nothing_else(self):
        self.client.force_authenticate(make("moderator", "mushrif"))

        self.assertEqual(self.client.get("/api/comments/").status_code, 200)
        self.assertEqual(
            self.client.patch(f"/api/sections/{self.section.key}/", {"name_ar": "مصر"}, format="json").status_code, 403
        )

    def test_an_admin_reaches_everything(self):
        self.client.force_authenticate(make("admin", "mudir"))

        self.assertEqual(self.client.get("/api/users/").status_code, 200)
        self.assertEqual(self.client.put("/api/settings/", {"site_name": "الدفتر"}, format="json").status_code, 200)
        self.assertEqual(
            self.client.patch(f"/api/sections/{self.section.key}/", {"name_ar": "مصر"}, format="json").status_code, 200
        )

    def test_a_superuser_bypasses_the_role_table(self):
        """A rescue account with no role set must still be able to fix things."""
        root = User.objects.create_superuser(username="root", password="pw")
        self.client.force_authenticate(root)

        self.assertEqual(self.client.get("/api/users/").status_code, 200)
        self.assertEqual(self.client.put("/api/settings/", {"site_name": "الدفتر"}, format="json").status_code, 200)

    def test_a_reader_who_signed_up_gets_none_of_it(self):
        reader = User.objects.create_user(username="qari", password="pw")  # is_staff=False, role=author
        self.client.force_authenticate(reader)

        self.assertEqual(self.client.get("/api/dashboard/overview/").status_code, 403)
        self.assertEqual(
            self.client.post("/api/articles/", {"title": "خبر"}, format="json").status_code, 403
        )


class OnboardingFlowTests(APITestCase):
    """Inviting someone and their first login."""

    def setUp(self):
        self.admin = make("admin", "mudir2")
        self.client.force_authenticate(self.admin)

    def _invite(self, **over):
        payload = {"username": "kateb.jadid", "email": "k@example.com", "role": "author", "first_name": "كاتب"}
        payload.update(over)
        return self.client.post("/api/users/", payload, format="json")

    def test_inviting_a_writer_returns_a_password_to_hand_over(self):
        res = self._invite()

        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data["temporary_password"])
        self.assertEqual(len(res.data["temporary_password"]), 12)

    def test_the_admin_may_choose_the_password_instead(self):
        res = self._invite(password="chosen-pw-123")

        self.assertEqual(res.data["temporary_password"], "chosen-pw-123")

    def test_the_new_writer_can_actually_log_in_with_it(self):
        issued = self._invite().data["temporary_password"]
        self.client.force_authenticate(None)

        res = self.client.post("/api/auth/login/", {"email": "k@example.com", "password": issued}, format="json")

        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data["is_staff_member"])
        self.assertTrue(res.data["must_change_password"])
        self.assertTrue(res.data["permissions"]["articles"])
        self.assertFalse(res.data["permissions"]["settings"])

    def test_the_created_row_is_complete_enough_for_the_table(self):
        """regression: the response carried only the posted fields, so the
        dashboard spliced a row with no name that rendered as «موقوف» and
        «منح دخول» — telling the admin the invite had failed when the account
        was live, active and staff."""
        res = self._invite()

        for field in ("name", "is_active", "is_staff", "role", "must_change_password"):
            self.assertIn(field, res.data, field)
        self.assertEqual(res.data["name"], "كاتب")
        self.assertTrue(res.data["is_active"])
        self.assertTrue(res.data["is_staff"])

    def test_the_password_is_never_readable_again(self):
        user_id = self._invite().data["id"]

        row = self.client.get(f"/api/users/{user_id}/").data

        self.assertNotIn("temporary_password", row)
        self.assertNotIn("password", row)

    def test_changing_the_password_ends_the_forced_change(self):
        issued = self._invite().data["temporary_password"]
        writer = User.objects.get(username="kateb.jadid")
        self.client.force_authenticate(writer)

        res = self.client.post(
            "/api/auth/change-password/",
            {"current_password": issued, "new_password": "my-own-password"},
            format="json",
        )

        self.assertEqual(res.status_code, 204)
        writer.refresh_from_db()
        self.assertFalse(writer.must_change_password)
        self.assertTrue(writer.check_password("my-own-password"))

    def test_only_an_admin_may_invite(self):
        self.client.force_authenticate(make("editor", "muharrir2"))

        self.assertEqual(self._invite(username="sneaky").status_code, 403)


class OffboardingTests(APITestCase):
    """Removing someone without removing what they wrote."""

    def setUp(self):
        self.admin = make("admin", "mudir3")
        self.writer = make("author", "leaver", first_name="سارة", last_name="محمد")
        self.section = Section.objects.create(key="egypt", name_ar="شؤون مصر")
        self.article = Article.objects.create(
            title="تحقيق سارة", section=self.section, author=self.writer,
            status=Article.Status.PUBLISHED, published_at=timezone.now(),
        )
        self.client.force_authenticate(self.admin)

    def test_deactivating_keeps_everything_on_the_site(self):
        res = self.client.patch(f"/api/users/{self.writer.pk}/", {"is_active": False}, format="json")

        self.assertEqual(res.status_code, 200)
        self.article.refresh_from_db()
        self.assertEqual(self.article.status, "published")
        self.assertEqual(self.article.author_id, self.writer.pk)

    def test_a_deactivated_account_cannot_log_in(self):
        self.writer.is_active = False
        self.writer.save(update_fields=["is_active"])
        self.client.force_authenticate(None)

        res = self.client.post("/api/auth/login/", {"username": "leaver", "password": "pw"}, format="json")

        self.assertEqual(res.status_code, 403)
        # ...and is told they are suspended, not that they mistyped: Django
        # refuses inactive accounts inside authenticate(), so this used to
        # come back as "wrong password" and send them round the reset loop.
        self.assertIn("موقوف", res.data["detail"])

    def test_a_wrong_password_on_a_suspended_account_still_says_nothing(self):
        """The suspended message is only for someone who proved they hold the
        password — otherwise it is an account-enumeration oracle."""
        self.writer.is_active = False
        self.writer.save(update_fields=["is_active"])
        self.client.force_authenticate(None)

        res = self.client.post("/api/auth/login/", {"username": "leaver", "password": "wrong"}, format="json")

        self.assertEqual(res.status_code, 401)
        self.assertNotIn("موقوف", res.data["detail"])

    def test_deleting_the_account_never_deletes_the_articles(self):
        res = self.client.delete(f"/api/users/{self.writer.pk}/")

        self.assertEqual(res.status_code, 204)
        self.article.refresh_from_db()
        self.assertEqual(self.article.status, "published")

    def test_deleting_keeps_the_credit_on_the_story(self):
        """Article.author is SET_NULL, so the FK survives deletion — but the
        byline is read from it, so the story would silently lose its credit.
        The name is stamped onto the article's own byline field first."""
        self.client.delete(f"/api/users/{self.writer.pk}/")

        self.article.refresh_from_db()
        self.assertIsNone(self.article.author_id)
        self.assertEqual(self.article.byline, "سارة محمد")

    def test_the_public_card_still_shows_the_name_after_deletion(self):
        self.client.delete(f"/api/users/{self.writer.pk}/")
        self.client.force_authenticate(None)

        card = self.client.get("/api/articles/?status=published").data["results"][0]

        self.assertEqual(card["author_name"], "سارة محمد")

    def test_a_manual_byline_already_set_is_not_overwritten(self):
        self.article.byline = "فريق التحرير"
        self.article.save(update_fields=["byline"])

        self.client.delete(f"/api/users/{self.writer.pk}/")

        self.article.refresh_from_db()
        self.assertEqual(self.article.byline, "فريق التحرير")

    def test_an_admin_cannot_delete_themselves(self):
        """The way a newsroom ends up with no way back into its own dashboard."""
        res = self.client.delete(f"/api/users/{self.admin.pk}/")

        self.assertEqual(res.status_code, 409)
        self.assertTrue(User.objects.filter(pk=self.admin.pk).exists())
