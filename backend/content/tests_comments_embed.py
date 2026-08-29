"""
The comments embedded on the article detail.

/api/comments/ is PublicSubmission — anonymous POST, staff-only GET — so the
article detail is the only place a reader can read the conversation from.
That makes its filter a security boundary, not a display choice: the payload
is cached by the public article page for every visitor for the revalidate
window, so a pending or banned row that slips in once is served to everyone.
"""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from content.models import Article, Comment, Section

User = get_user_model()


class ArticleCommentsEmbedTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.section = Section.objects.create(key="egypt", name_ar="شؤون مصر", order=1)
        cls.article = Article.objects.create(
            title="خبر منشور", slug="published-one", section=cls.section,
            status=Article.Status.PUBLISHED,
        )
        cls.approved = Comment.objects.create(
            article=cls.article, user_name="منى", text="تعليق معتمد", status=Comment.Status.APPROVED
        )
        Comment.objects.create(
            article=cls.article, user_name="متسرّع", text="لسه في الطابور", status=Comment.Status.PENDING
        )

    def test_detail_embeds_only_approved_comments(self):
        res = self.client.get(f"/api/articles/{self.article.slug}/")

        comments = res.json()["comments"]
        self.assertEqual([c["user_name"] for c in comments], ["منى"])
        self.assertEqual(comments[0]["text"], "تعليق معتمد")

    def test_embedded_rows_carry_no_moderation_columns(self):
        res = self.client.get(f"/api/articles/{self.article.slug}/")

        row = res.json()["comments"][0]
        self.assertEqual(set(row.keys()), {"id", "user_name", "text", "created_at"})

    def test_pending_text_never_appears_anywhere_in_the_payload(self):
        body = self.client.get(f"/api/articles/{self.article.slug}/").content.decode()

        self.assertNotIn("لسه في الطابور", body)

    def test_staff_get_the_same_public_view_here(self):
        """
        The queue lives at /api/comments/; the article detail is a public
        surface even when a staff session fetches it, because the render it
        feeds is cached for anonymous readers too.
        """
        staff = User.objects.create_user(username="editor2", password="pw", is_staff=True, role="moderator")
        self.client.force_authenticate(staff)

        comments = self.client.get(f"/api/articles/{self.article.slug}/").json()["comments"]

        self.assertEqual(len(comments), 1)

    def test_newest_approved_comment_comes_first(self):
        Comment.objects.create(
            article=self.article, user_name="أحدث", text="وصل بعدها", status=Comment.Status.APPROVED
        )

        comments = self.client.get(f"/api/articles/{self.article.slug}/").json()["comments"]

        self.assertEqual([c["user_name"] for c in comments], ["أحدث", "منى"])

    def test_a_reader_can_still_submit_and_lands_pending(self):
        res = self.client.post(
            "/api/comments/",
            {"article": self.article.pk, "user_name": "قارئ", "text": "رأيي كذا", "status": "approved"},
            format="json",
        )

        self.assertEqual(res.status_code, 201)
        # The smuggled status="approved" is pinned back to pending — and so
        # the new row must NOT surface on the public article yet.
        created = Comment.objects.get(text="رأيي كذا")
        self.assertEqual(created.status, Comment.Status.PENDING)
        body = self.client.get(f"/api/articles/{self.article.slug}/").content.decode()
        self.assertNotIn("رأيي كذا", body)
