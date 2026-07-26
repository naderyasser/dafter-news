import math

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify


class Section(models.Model):
    """Section.dc.html taxonomy — مصر / اقتصاد / رياضة / بالعقل والمنطق / لقطة وتعليق."""

    key = models.SlugField(max_length=40, unique=True, help_text="egypt / economy / sports ...")
    name_ar = models.CharField(max_length=60)
    name_en = models.CharField(max_length=60, blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.name_ar

    @property
    def article_count(self):
        return self.articles.filter(status="published").count()


class Tag(models.Model):
    name = models.CharField(max_length=60, unique=True)
    # allow_unicode so Arabic tag names keep a readable, resolvable slug
    # (/tag/الذهب) instead of being stripped to an empty string.
    slug = models.SlugField(max_length=70, unique=True, allow_unicode=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Article(models.Model):
    """
    News article or opinion piece (بالعقل والمنطق).

    Body is structured blocks (ArticleBlock), not raw HTML — per brief §11:
    "متن المقال في Django = structured blocks (JSON) وليس HTML خام — هذا ما
    يسمح بـ«اقرأ أيضاً» داخل المتن". Read time is computed from word count
    (عربي: كلمات ÷ 200) rather than stored, so it always reflects the body.
    """

    class Kind(models.TextChoices):
        NEWS = "news", "خبر"
        OPINION = "opinion", "رأي"

    class Status(models.TextChoices):
        DRAFT = "draft", "مسودة"
        REVIEW = "review", "قيد المراجعة"
        SCHEDULED = "scheduled", "مجدول"
        PUBLISHED = "published", "منشور"
        REJECTED = "rejected", "مرفوض"

    class Badge(models.TextChoices):
        NONE = "none", "بدون"
        BREAKING = "breaking", "عاجل"
        EXCLUSIVE = "exclusive", "خاص"
        LIVE = "live", "مباشر"

    class Language(models.TextChoices):
        AR = "ar", "العربية"
        EN = "en", "English"

    title = models.CharField(max_length=280)
    # allow_unicode so an Arabic headline yields a readable slug rather than
    # being stripped to nothing; auto-derived from title in save() when blank.
    slug = models.SlugField(max_length=300, unique=True, allow_unicode=True, blank=True)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.NEWS)
    section = models.ForeignKey(Section, on_delete=models.PROTECT, related_name="articles", null=True, blank=True)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="articles", null=True, blank=True
    )
    tags = models.ManyToManyField(Tag, blank=True, related_name="articles")
    language = models.CharField(max_length=2, choices=Language.choices, default=Language.AR)
    related_article = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="translations",
        help_text="ربط اختياري بنسخة المقال باللغة الأخرى",
    )

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    badge = models.CharField(max_length=12, choices=Badge.choices, default=Badge.NONE)

    standfirst = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to="covers/", blank=True, null=True)
    cover_caption = models.CharField(max_length=200, blank=True)
    cover_credit = models.CharField(max_length=120, blank=True)

    views = models.PositiveIntegerField(default=0)

    tts_status = models.CharField(
        max_length=10,
        choices=[("idle", "idle"), ("generating", "generating"), ("done", "done")],
        default="idle",
    )
    tts_audio = models.FileField(upload_to="tts/", blank=True, null=True)
    tts_duration_seconds = models.PositiveIntegerField(default=0)

    published_at = models.DateTimeField(null=True, blank=True)
    scheduled_for = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-published_at", "-created_at"]

    def save(self, *args, **kwargs):
        """Derive a unique slug from the title when the caller didn't supply
        one (the dashboard editor doesn't — it can't slugify Arabic in the
        browser without stripping it to nothing)."""
        if not self.slug:
            base = slugify(self.title, allow_unicode=True) or "article"
            slug = base[:290]
            n = 2
            while Article.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base[:285]}-{n}"
                n += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title

    @property
    def word_count(self):
        text = self.standfirst or ""
        for block in self.blocks.filter(type=ArticleBlock.Type.PARAGRAPH):
            text += " " + (block.text or "")
        return len([w for w in text.split() if w])

    @property
    def read_minutes(self):
        """كلمات ÷ 200 للعربي — brief §11."""
        return max(1, math.ceil(self.word_count / 200))


class ArticleBlock(models.Model):
    """One block of the block-editor body (DashArticleEditor.dc.html)."""

    class Type(models.TextChoices):
        PARAGRAPH = "paragraph", "فقرة"
        HEADING = "heading", "عنوان فرعي"
        IMAGE = "image", "صورة"
        QUOTE = "quote", "اقتباس"
        RELATED = "related", "اقرأ أيضاً"

    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name="blocks")
    order = models.PositiveSmallIntegerField(default=0)
    type = models.CharField(max_length=10, choices=Type.choices)
    text = models.TextField(blank=True)
    image = models.ImageField(upload_to="article_blocks/", blank=True, null=True)
    caption = models.CharField(max_length=240, blank=True)
    credit = models.CharField(max_length=120, blank=True)
    related_article = models.ForeignKey(
        Article, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.article_id} · {self.type} #{self.order}"


class Comment(models.Model):
    """Moderation queue row (DashComments.dc.html) for an article."""

    class Status(models.TextChoices):
        PENDING = "pending", "معلّق"
        APPROVED = "approved", "مقبول"
        BANNED = "banned", "محظور"

    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name="comments")
    user_name = models.CharField(max_length=80, default="زائر")
    text = models.TextField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user_name}: {self.text[:30]}"


class BreakingNewsItem(models.Model):
    """Rows for شريط «عاجل» (DashBreaking.dc.html)."""

    text = models.CharField(max_length=280)
    order = models.PositiveSmallIntegerField(default=0)
    active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "-created_at"]

    def __str__(self):
        return self.text
