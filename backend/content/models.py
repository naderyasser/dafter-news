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
    # The home-page masthead: a full-bleed banner photo behind the section's
    # title and a one-line tagline, set into the image itself rather than
    # printed below it. Both optional — a section with neither still renders
    # its plain heading exactly as before, the same graceful fallback
    # SECTION_IDENTITY already uses when a section has no accent colour.
    cover_image = models.ImageField(upload_to="sections/", blank=True, null=True)
    tagline = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.name_ar

    @property
    def article_count(self):
        return self.articles.filter(status="published").count()


class Story(models.Model):
    """
    A card in the homepage stories rail — the social-style horizontal strip
    of tall cards. Kept separate from Article because a story is a curated
    promo slot: an editor picks the image and the destination, which may be
    an article, a section, or an external page.
    """

    title = models.CharField(max_length=120)
    image = models.ImageField(upload_to="stories/", blank=True, null=True)
    href = models.CharField(max_length=300, blank=True)
    section = models.ForeignKey("Section", null=True, blank=True, on_delete=models.SET_NULL, related_name="stories")
    active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "-created_at"]
        verbose_name_plural = "stories"

    def __str__(self):
        return self.title


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
    # Free-text label under the section — «سياسة» / «ثقافة وفنون» / «اقتصاد».
    # Cards inside a section block already sit under its heading, so repeating
    # the section name on each one says nothing; this is what the red tag in
    # the «عرب وعالم» grid shows instead. Deliberately not a FK: the labels are
    # editorial shorthand that varies per section and shouldn't need a taxonomy
    # row (and a new one shouldn't need a migration).
    subcategory = models.CharField(max_length=60, blank=True, help_text="تصنيف فرعي يظهر كوسم أحمر على البطاقة")
    # The geographic chip on «الخليج» and «عرب وعالم» cards (الكويت / قطر /
    # الجزائر…). Separate from subcategory on purpose: world stories already
    # use that for the topic («سياسة»), and a Kuwait politics piece needs
    # both — the country on the photo, the topic in the kicker. Free text
    # like subcategory, and for the same reason.
    country = models.CharField(max_length=60, blank=True, help_text="اسم الدولة — يظهر كشارة على صورة الخبر في «الخليج» و«عرب وعالم»")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="articles", null=True, blank=True
    )
    # Manual byline — free text, typed in the editor rather than picked from
    # the account list. Deliberately separate from `author`: that FK is what
    # the columnist system (bio page, portrait, «بالعقل والمنطق») is built
    # on, and a news byline shouldn't have to be a real account just to
    # exist — a guest contributor or "فريق التحرير" credit has nowhere else
    # to go. Wins over the linked author's name when both are set (see
    # ArticleCardSerializer.get_author_name) — a manual credit is a deliberate
    # override, not a fallback that should lose to whatever account happens
    # to be linked.
    byline = models.CharField(max_length=120, blank=True, help_text="اسم الكاتب يُكتب يدوياً — يظهر تحت العنوان")
    tags = models.ManyToManyField(Tag, blank=True, related_name="articles")
    language = models.CharField(max_length=2, choices=Language.choices, default=Language.AR)
    related_article = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="translations",
        help_text="ربط اختياري بنسخة المقال باللغة الأخرى",
    )

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    badge = models.CharField(max_length=12, choices=Badge.choices, default=Badge.NONE)
    # «تثبيت في الرئيسية» — pinned articles lead the home hero regardless of
    # publish time, so editorial can hold a big story at the top with one
    # click instead of re-dating it.
    pinned = models.BooleanField(default=False)

    # The site-wide floating notification — distinct from `badge=breaking`,
    # which only decorates this article's own card wherever it's displayed.
    # This instead surfaces the article on every page as a dismissible popup.
    # No separate "sent at" timestamp: the notification's 24h window is read
    # off `published_at` itself, so un-publishing or rescheduling the article
    # naturally drops it rather than leaving a stale flag to remember to undo.
    notify_urgent = models.BooleanField(default=False, help_text="يظهر كإشعار عائم في كل صفحات الموقع لمدة 24 ساعة من النشر")
    notify_label = models.CharField(max_length=40, blank=True, default="خبر عاجل", help_text='العنوان الفرعي للإشعار، مثال: "يحدث الآن"')

    standfirst = models.TextField(blank=True)
    # width_field/height_field: Django/Pillow stamp the real pixel size onto
    # these two columns every time cover_image is saved — no extra request-
    # time cost to read them back. What they're for: the article's og:image
    # meta tags need to declare the file's ACTUAL dimensions, not a guess.
    # A wrong declared size is a documented reason Facebook/WhatsApp's
    # crawler drops the image from a link preview outright rather than just
    # rendering it slightly cropped — see ArticleDetailSerializer and
    # frontend/lib/seo.ts's articleMetadata.
    cover_image = models.ImageField(
        upload_to="covers/", blank=True, null=True,
        width_field="cover_image_width", height_field="cover_image_height",
    )
    cover_image_width = models.PositiveIntegerField(null=True, blank=True, editable=False)
    cover_image_height = models.PositiveIntegerField(null=True, blank=True, editable=False)
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
        browser without stripping it to nothing).

        Also stamps `published_at` the first time an article becomes
        PUBLISHED, if nothing set it already — the same "only if empty"
        policy `publish_scheduled` already applies to the scheduled-publish
        path. Without this, the dashboard's direct «نشر الآن» button (a
        plain PATCH to status=published, no published_at in the payload)
        left the field NULL forever. That silently broke everything that
        reads it: the urgent-notification popup filters on
        `published_at__gte=cutoff`, which a NULL never satisfies, so a
        freshly published, notify_urgent=True article never appeared as a
        site-wide alert — the exact "the notification button doesn't do
        anything" report. Only stamped once, so an already-published
        article being edited and re-saved keeps its original date.
        """
        if not self.slug:
            base = slugify(self.title, allow_unicode=True) or "article"
            slug = base[:290]
            n = 2
            while Article.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base[:285]}-{n}"
                n += 1
            self.slug = slug
        if self.status == self.Status.PUBLISHED and not self.published_at:
            self.published_at = timezone.now()
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

    class Align(models.TextChoices):
        LEFT = "left", "محاذاة اليسار"
        CENTER = "center", "محاذاة الوسط"
        RIGHT = "right", "محاذاة اليمين"
        JUSTIFY = "justify", "ضبط"

    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name="blocks")
    order = models.PositiveSmallIntegerField(default=0)
    type = models.CharField(max_length=10, choices=Type.choices)
    text = models.TextField(blank=True)
    # Paragraph text alignment — the editor's alignment menu (left/center/
    # right/justify, the client's literal reference). Only meaningful for
    # paragraph/quote blocks; harmless (and unread) on the rest. Physical
    # left/right rather than logical start/end on purpose: the menu is a
    # deliberate override an editor reaches for, same posture as a word
    # processor's — it should mean the same side regardless of the
    # article's own language/direction.
    # Justify by default — matches the justified-column look of Sky News
    # Arabia / Al Hadath rather than the ragged edge a single-side alignment
    # leaves, so a freshly written paragraph doesn't look like it has
    # randomly different line lengths. Only the DEFAULT changed: existing
    # rows keep whatever alignment they were saved with.
    align = models.CharField(max_length=10, choices=Align.choices, default=Align.JUSTIFY, help_text="محاذاة الفقرة")
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
    # Where the ticker entry leads when clicked — the client asked for the
    # «عاجل» strip to open the full story, not to be decoration. Blank means
    # the item renders as plain text (a flash with no article yet).
    href = models.CharField(max_length=300, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "-created_at"]

    def __str__(self):
        return self.text
