"""Tests for accounts: the custom User (which doubles as the public author
record), plus the authors/users endpoints the dashboard drives."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase

from content.models import Article, Section
from accounts.models import Follow

User = get_user_model()


class UserModelTests(TestCase):
    def test_display_name_prefers_full_name(self):
        user = User.objects.create(username="m.eladawy", first_name="محمد", last_name="العدوي")

        self.assertEqual(user.display_name, "محمد العدوي")

    def test_display_name_falls_back_to_username(self):
        user = User.objects.create(username="lonely")

        self.assertEqual(user.display_name, "lonely")

    def test_initial_strips_arabic_honorific(self):
        """Avatar circles show a single letter; «د.» is a title, not a name,
        so the initial should be the first letter of the actual name."""
        user = User.objects.create(username="s.farouk", first_name="د. سامية", last_name="فاروق")

        self.assertEqual(user.initial, "س")

    def test_initial_strips_english_honorific(self):
        user = User.objects.create(username="j.doe", first_name="Dr. Jane", last_name="Doe")

        self.assertEqual(user.initial, "J")

    def test_initial_never_raises_on_empty_name(self):
        user = User.objects.create(username="")

        self.assertEqual(user.initial, "?")

    def test_default_role_is_author(self):
        user = User.objects.create(username="someone")

        self.assertEqual(user.role, User.Role.AUTHOR)


class UserCreateSerializerTests(TestCase):
    def test_create_without_password_yields_unusable_password(self):
        """regression: this used to call UserManager.make_random_password(),
        removed in Django 5.1, so creating a user from the dashboard 500'd.
        An account created without a password must not be logged into."""
        from accounts.serializers import UserCreateSerializer

        serializer = UserCreateSerializer(data={"username": "newuser", "email": "n@example.com", "role": "editor"})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()

        self.assertFalse(user.has_usable_password())
        self.assertEqual(user.role, "editor")

    def test_create_with_password_sets_and_hashes_it(self):
        from accounts.serializers import UserCreateSerializer

        serializer = UserCreateSerializer(data={"username": "withpw", "password": "s3cret-pass", "role": "author"})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()

        self.assertTrue(user.has_usable_password())
        self.assertNotEqual(user.password, "s3cret-pass")
        self.assertTrue(user.check_password("s3cret-pass"))

    def test_create_sets_is_staff_for_a_newsroom_role(self):
        """regression: is_staff was never derived from role, so an editor/
        moderator/admin account created from the dashboard's "Users & roles"
        panel could authenticate but every staff-gated endpoint still 403'd."""
        from accounts.serializers import UserCreateSerializer

        serializer = UserCreateSerializer(data={"username": "mod1", "role": "moderator"})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()

        self.assertTrue(user.is_staff)

    def test_create_author_role_stays_non_staff(self):
        """"author" is the byline-only columnist posture (AuthorSerializer),
        not a dashboard operator — it must not be granted is_staff."""
        from accounts.serializers import UserCreateSerializer

        serializer = UserCreateSerializer(data={"username": "col1", "role": "author"})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()

        self.assertFalse(user.is_staff)


class AuthorAPITests(APITestCase):
    def setUp(self):
        self.section = Section.objects.create(key="egypt", name_ar="مصر")
        self.author = User.objects.create(
            username="m.eladawy", first_name="محمد", last_name="العدوي",
            role=User.Role.AUTHOR, title="محرر الشؤون المصرية",
        )
        self.moderator = User.objects.create(username="mod1", first_name="مشرف", role=User.Role.MODERATOR)

    def test_lookup_by_dotted_username(self):
        """regression: DRF's default lookup regex excludes '.', so authors
        with dotted usernames (m.eladawy) 404'd on their own profile page."""
        res = self.client.get("/api/authors/m.eladawy/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["name"], "محمد العدوي")

    def test_list_excludes_moderators(self):
        """Only authors and editors have public bylines."""
        res = self.client.get("/api/authors/")

        usernames = [a["username"] for a in res.json()["results"]]
        self.assertIn("m.eladawy", usernames)
        self.assertNotIn("mod1", usernames)

    def test_article_count_counts_only_published(self):
        Article.objects.create(title="منشور", slug="a-pub", author=self.author, status=Article.Status.PUBLISHED)
        Article.objects.create(title="مسودة", slug="a-draft", author=self.author, status=Article.Status.DRAFT)

        res = self.client.get("/api/authors/m.eladawy/")

        self.assertEqual(res.json()["article_count"], 1)


class UserAPITests(APITestCase):
    def setUp(self):
        # /api/users/ is AdminOnly (accounts carry emails, roles, last_login)
        # — every call in this class needs an admin caller, not just staff.
        self.admin = User.objects.create(username="root-admin", role=User.Role.ADMIN, is_staff=True)
        self.client.force_authenticate(self.admin)

    def test_create_user_via_api(self):
        """regression: this endpoint 500'd on Django 5.x (make_random_password)."""
        res = self.client.post(
            "/api/users/",
            {"username": "dashuser", "first_name": "مستخدم", "email": "d@aldaftarnews.com", "role": "moderator"},
            format="json",
        )

        self.assertEqual(res.status_code, 201)
        self.assertTrue(User.objects.filter(username="dashuser", role="moderator").exists())

    def test_create_via_api_grants_is_staff(self):
        """The API path exercises the same regression as
        UserCreateSerializerTests, end to end through the view."""
        res = self.client.post(
            "/api/users/", {"username": "editor1", "role": "editor"}, format="json",
        )

        self.assertEqual(res.status_code, 201)
        self.assertTrue(User.objects.get(username="editor1").is_staff)

    def test_role_change_via_api_updates_is_staff(self):
        """regression: PATCHing role through /api/users/ silently left the
        staff flag untouched, so a promoted account stayed powerless."""
        user = User.objects.create(username="promote-me", role=User.Role.AUTHOR, is_staff=False)

        res = self.client.patch(f"/api/users/{user.pk}/", {"role": "editor"}, format="json")

        self.assertEqual(res.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.is_staff)

    def test_list_exposes_role_and_email(self):
        User.objects.create(username="u1", first_name="أ", email="u1@x.com", role=User.Role.ADMIN)

        res = self.client.get("/api/users/")
        row = next(r for r in res.json()["results"] if r["username"] == "u1")

        self.assertEqual(row["role"], "admin")
        self.assertEqual(row["email"], "u1@x.com")

    def test_list_never_exposes_password_hash(self):
        User.objects.create(username="secret", password="hashed-value")

        res = self.client.get("/api/users/")

        self.assertNotIn("password", res.json()["results"][0])


class FollowAPITests(APITestCase):
    def setUp(self):
        self.reader = User.objects.create(username="reader1")
        self.other_author = User.objects.create(username="writer1", role=User.Role.AUTHOR)
        self.section = Section.objects.create(key="egypt", name_ar="مصر")
        self.client.force_authenticate(self.reader)

    def test_patching_only_section_on_an_author_follow_is_rejected(self):
        """regression: validate() only looked at the keys present in the
        partial PATCH body, so PATCHing {"section": <id>} onto a Follow that
        already has `author` set skipped the "pick exactly one" check
        entirely (attrs had no "author" key) and fell through to an
        unhandled IntegrityError against follow_targets_exactly_one instead
        of a clean 400."""
        follow = Follow.objects.create(user=self.reader, author=self.other_author)

        res = self.client.patch(f"/api/follows/{follow.pk}/", {"section": self.section.pk}, format="json")

        self.assertEqual(res.status_code, 400)
        follow.refresh_from_db()
        self.assertEqual(follow.author_id, self.other_author.id)
        self.assertIsNone(follow.section_id)

    def test_patching_author_to_clear_it_while_setting_section_is_allowed(self):
        """The merged-state check must not block a PATCH that legitimately
        switches a follow from an author to a section in one request."""
        follow = Follow.objects.create(user=self.reader, author=self.other_author)

        res = self.client.patch(
            f"/api/follows/{follow.pk}/",
            {"section": self.section.pk, "author": None},
            format="json",
        )

        self.assertEqual(res.status_code, 200)
        follow.refresh_from_db()
        self.assertEqual(follow.section_id, self.section.id)
        self.assertIsNone(follow.author_id)
