"""
Regression: a linked columnist's photo must survive a manual byline.

The bug, as reported from production: «ماهر فرغلي»'s portrait showed on his
article page but NOT on the homepage opinion carousel or the section grid —
the same author, the same photo, visible in one place and missing in two.

The cause was here, in ArticleCardSerializer.get_author_avatar: it suppressed
the avatar whenever `byline` was non-empty, copying the rule the *name*
fields use. That rule is right for a name — a manual byline is a deliberate
"who wrote this" override, so a card must not print account A's name under
byline B. It is wrong for the photo, because the photo is not part of the
override; it is simply whether the linked account ever uploaded one.

The state that exposed it is the ordinary one for legacy rows: an editor
links an author AND leaves the old typed byline in the field, because until
the dashboard grew an author picker the byline was the only way to credit
anyone. Every such article silently lost its photo everywhere a card is
drawn.

ArticleDetailSerializer nests the whole AuthorSerializer and never consulted
`byline`, which is exactly why the article page looked correct and hid the
bug from anyone checking a single story.
"""
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APITestCase

from content.models import Article, Section

User = get_user_model()

# A one-pixel GIF — the smallest thing ImageField will accept, so the test
# exercises the real `.avatar.url` path without shipping a fixture file.
PIXEL = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!"
    b"\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
)


class AuthorAvatarSurvivesBylineTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.section = Section.objects.create(key="pol", name_ar="سياسة", order=1)
        cls.author = User.objects.create_user(
            username="mahir",
            password="pw",
            first_name="ماهر",
            last_name="فرغلي",
            role=User.Role.AUTHOR,
        )
        cls.author.avatar = SimpleUploadedFile("mahir.gif", PIXEL, content_type="image/gif")
        cls.author.save()

    def _article(self, **extra):
        return Article.objects.create(
            title="الإخوان بين الانحسار والتمدد",
            section=self.section,
            status="published",
            published_at=timezone.now(),
            **extra,
        )

    def _card(self, article):
        """The card shape, fetched the way every list surface fetches it."""
        res = self.client.get("/api/articles/")
        self.assertEqual(res.status_code, 200)
        row = next(r for r in res.data["results"] if r["id"] == article.id)
        return row

    def test_avatar_shows_when_author_linked_and_no_byline(self):
        """The baseline that always worked — guards the fix from over-reaching."""
        article = self._article(author=self.author, byline="")

        self.assertIn("mahir", self._card(article)["author_avatar"] or "")

    def test_avatar_survives_a_manual_byline_on_a_linked_author(self):
        """The reported bug: photo vanished from every card, kept on the page."""
        article = self._article(author=self.author, byline="ماهر فرغلي")

        card = self._card(article)
        self.assertIsNotNone(
            card["author_avatar"],
            "a linked author's photo must not be suppressed by a manual byline",
        )
        self.assertIn("mahir", card["author_avatar"])

    def test_byline_still_overrides_the_displayed_name(self):
        """
        The override that SHOULD survive. Without this, a fix to the avatar
        could quietly turn the byline back into a mere fallback, which is the
        opposite bug: account A's name printed under byline B.
        """
        article = self._article(author=self.author, byline="فريق التحرير")

        card = self._card(article)
        self.assertEqual(card["author_name"], "فريق التحرير")
        self.assertEqual(card["author_initial"], "ف")
        # No profile link either — the credited writer has no account.
        self.assertIsNone(card["author_username"])

    def test_no_avatar_when_there_is_no_linked_account(self):
        """A typed byline alone still has no photo to show."""
        article = self._article(author=None, byline="ضيف")

        self.assertIsNone(self._card(article)["author_avatar"])

    def test_no_avatar_when_the_linked_account_never_uploaded_one(self):
        """Distinguishes "suppressed" from "never had one" — the null is real."""
        bare = User.objects.create_user(username="s.farouk", password="pw", first_name="سامية")
        article = self._article(author=bare, byline="سامية فاروق")

        self.assertIsNone(self._card(article)["author_avatar"])
