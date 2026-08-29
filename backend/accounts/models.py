from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Site user / dashboard operator.

    Roles map 1:1 to StatusBadge.dc.html's role options and to §8.3.13 of
    the brief (المستخدمون والأدوار): admin / editor / author / moderator.
    Authors double as the public-facing "بالعقل والمنطق" writers and
    byline authors — Authors.dc.html / AuthorPage.dc.html read straight
    off this model rather than a separate profile table.
    """

    class Role(models.TextChoices):
        ADMIN = "admin", "مدير"
        EDITOR = "editor", "محرر"
        AUTHOR = "author", "كاتب"
        MODERATOR = "moderator", "مشرف تعليقات"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.AUTHOR)
    bio = models.CharField(max_length=280, blank=True, help_text="نبذة قصيرة تظهر في صفحة الكاتب")
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    title = models.CharField(max_length=120, blank=True, help_text="مثال: كاتبة اقتصادية")
    # The byline on the English side. first/last name are single columns
    # holding Arabic, so an English article carried an Arabic byline under an
    # English headline — same pattern Section solves with name_ar/name_en.
    name_en = models.CharField(max_length=120, blank=True, help_text="الاسم كما يظهر في النسخة الإنجليزية")
    # Takes the byline off the public «كتّاب الدفتر» and «بالعقل والمنطق»
    # surfaces without deleting the account or unpublishing what they wrote —
    # a columnist on hiatus keeps their archive reachable by direct link.
    is_hidden = models.BooleanField(default=False, help_text="إخفاء الكاتب من صفحات الموقع العامة")
    # Set when an admin invites a team member with a temporary password. The
    # dashboard refuses to show anything else until it is cleared, so a
    # password that was read aloud, pasted into chat or written on paper is
    # only ever good for the one login that replaces it.
    must_change_password = models.BooleanField(
        default=False, help_text="يجب على المستخدم تغيير كلمة المرور عند أول دخول"
    )

    @property
    def is_newsroom_admin(self):
        return bool(self.is_superuser or self.role == self.Role.ADMIN)

    @property
    def is_editorial(self):
        """Runs the paper: taxonomy, curation, site chrome."""
        return bool(self.is_superuser or (self.is_staff and self.role in {self.Role.ADMIN, self.Role.EDITOR}))

    @property
    def can_moderate_comments(self):
        return bool(
            self.is_superuser
            or (self.is_staff and self.role in {self.Role.ADMIN, self.Role.EDITOR, self.Role.MODERATOR})
        )

    @property
    def can_write_articles(self):
        """Every invited team member files or edits copy — that is the floor
        of what a dashboard account is for."""
        return bool(self.is_staff or self.is_superuser)

    class Meta:
        ordering = ["first_name", "last_name", "username"]

    def __str__(self):
        return self.get_full_name() or self.username

    @property
    def display_name(self):
        return self.get_full_name() or self.username

    @property
    def initial(self):
        name = self.display_name.replace("د. ", "").replace("Dr. ", "")
        return name[:1] if name else "?"


class Follow(models.Model):
    """
    A reader following a section or a byline.

    One table with two nullable targets rather than two tables: the feed query
    reads both in a single pass, and a follow is the same gesture either way.
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="follows")
    section = models.ForeignKey("content.Section", on_delete=models.CASCADE, null=True, blank=True, related_name="followers")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name="followed_by"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "section"], name="uniq_follow_section"),
            models.UniqueConstraint(fields=["user", "author"], name="uniq_follow_author"),
            models.CheckConstraint(
                condition=models.Q(section__isnull=False, author__isnull=True)
                | models.Q(section__isnull=True, author__isnull=False),
                name="follow_targets_exactly_one",
            ),
        ]

    def __str__(self):
        return f"{self.user_id} → {self.section_id or self.author_id}"


class SavedArticle(models.Model):
    """«اقرأ لاحقاً» — the reading list behind a reader account."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved")
    article = models.ForeignKey("content.Article", on_delete=models.CASCADE, related_name="saved_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["user", "article"], name="uniq_saved_article")]

    def __str__(self):
        return f"{self.user_id} ★ {self.article_id}"
