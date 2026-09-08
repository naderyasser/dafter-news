from django.db import models
from django.utils.text import slugify

#: How much of a title a reel's slug keeps: six words or fifty characters,
#: whichever comes first. Article/Video keep effectively the whole headline,
#: which is fine for a slug nobody looks at closely; a reel's slug is the
#: address a reader actually shares, and a full sentence turns into a wall of
#: percent-encoded Arabic the moment it lands in a WhatsApp share sheet.
REEL_SLUG_MAX_WORDS = 6
REEL_SLUG_MAX_CHARS = 50


def short_slug_base(title: str) -> str:
    """
    A slugified, word-and-length-capped base for a Reel's slug — not yet
    made unique (see Reel.assign_slug, which appends the -2/-3 suffix).

    A module-level function rather than a method so the migration that
    recalculated existing slugs (0007) could import this exact logic against
    its frozen historical model instead of carrying a drifting copy.

    Django's `slugify(allow_unicode=True)` already drops emoji, punctuation
    and extra whitespace; this only adds the word/character cap on top.
    """
    base = slugify(title, allow_unicode=True) or "reel"
    words = [w for w in base.split("-") if w]

    kept: list[str] = []
    length = 0
    for word in words[:REEL_SLUG_MAX_WORDS]:
        addition = len(word) + (1 if kept else 0)  # +1 for the joining hyphen
        if kept and length + addition > REEL_SLUG_MAX_CHARS:
            break
        kept.append(word)
        length += addition

    return "-".join(kept).strip("-") or "reel"


class Video(models.Model):
    """لقطة وتعليق — VideoList.dc.html / VideoPage.dc.html / DashVideos.dc.html."""

    title = models.CharField(max_length=280)
    # Blank on write: derived from the title in save(), same as Article — the
    # dashboard can't slugify an Arabic title in the browser without stripping
    # it to nothing.
    slug = models.SlugField(max_length=300, unique=True, allow_unicode=True, blank=True)
    section = models.ForeignKey("content.Section", on_delete=models.SET_NULL, null=True, blank=True, related_name="videos")
    description = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to="video_covers/", blank=True, null=True)
    file = models.FileField(upload_to="videos/", blank=True, null=True)
    # Either upload the file or point at one that's already hosted (YouTube,
    # a CDN, the station's own player). The dashboard offers both; the player
    # prefers the uploaded file when both are set.
    external_url = models.URLField(max_length=500, blank=True, help_text="رابط فيديو خارجي بديلاً عن رفع الملف")
    duration_seconds = models.PositiveIntegerField(default=0)
    is_live = models.BooleanField(default=False)
    is_exclusive = models.BooleanField(default=False)
    views = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title, allow_unicode=True) or "video"
            slug = base[:290]
            n = 2
            while Video.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base[:285]}-{n}"
                n += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title

    @property
    def duration_label(self):
        if self.is_live or not self.duration_seconds:
            return "—"
        m, s = divmod(self.duration_seconds, 60)
        return f"{m:02d}:{s:02d}"


class Reel(models.Model):
    """
    «حصل إيه؟» — a vertical shorts shelf on the home page, fed by YouTube.

    The one field an editor fills in is `url`, a link to a YouTube Short (or
    any YouTube video). Everything else is derived from it: `youtube_id` is
    parsed out in save() and is what the public player embeds; `title` and
    `thumbnail` are read off YouTube's own oEmbed/thumbnail endpoints by
    video/youtube.py at create time, and stay writable only as an override
    for the reel whose scraped caption isn't the headline the desk wants.

    Each reel has a real, shareable page at /reel/<slug>, and the home page
    rail opens it in a lightbox player on top of the page it is on.

    Ordering: `order` first so the desk can pin a reel to the head of the
    rail, then newest. `order` defaults to 0, which leaves the rail purely
    chronological until someone deliberately reorders it.
    """

    # blank=True: the dashboard's add form asks for the link alone — the
    # title is fetched from YouTube after the row exists (see
    # ReelSerializer). A blank submission is the normal path, so the model
    # has to agree, or the Django admin's own add form would demand a field
    # the newsroom is never shown.
    title = models.CharField(max_length=200, blank=True)
    # Blank on write, like Video/Article — but NOT auto-derived in save() on
    # every row: a reel's title is not known yet at its own first save. See
    # assign_slug().
    slug = models.SlugField(max_length=300, unique=True, allow_unicode=True, blank=True)
    thumbnail = models.ImageField(upload_to="reels/", blank=True, null=True)
    # A URLField, not a plain CharField: a mistyped link is a dead card.
    url = models.URLField(
        max_length=500,
        help_text="رابط الفيديو على يوتيوب (Short أو فيديو عادي) — العنوان والصورة يُجلبان منه تلقائياً",
    )
    # Derived from `url` on every save (see save()). Blank means the stored
    # link is not a YouTube video link at all — such rows are hidden from the
    # public rail and flagged in the dashboard rather than deleted.
    youtube_id = models.CharField(max_length=16, blank=True, default="", db_index=True, editable=False)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "-created_at"]

    def assign_slug(self):
        """
        Derive this reel's slug from its CURRENT title, unique against every
        other reel.

        Not wired into save() the way Video/Article auto-slug every row —
        those know their real title at the very first save. A reel does not:
        ReelSerializer.create() saves the row first, THEN fetches the title
        from YouTube, so slugifying on that first save would freeze the slug
        against a blank title. Called explicitly once the title has settled
        instead — see ReelSerializer._finalize.
        """
        base = short_slug_base(self.title)
        slug = base
        n = 2
        while Reel.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug = f"{base}-{n}"
            n += 1
        self.slug = slug

    def save(self, *args, **kwargs):
        # Re-derived on every save rather than only when blank, so a link
        # edited in the Django admin can never leave a stale id behind.
        from .youtube import extract_video_id

        self.youtube_id = extract_video_id(self.url) or ""
        is_new = self._state.adding
        super().save(*args, **kwargs)
        if is_new and not self.slug:
            # A brand-new row needs SOME unique slug the instant it exists,
            # title or no title — two reels created moments apart, both
            # still mid-fetch with a blank title, would otherwise both try
            # to persist slug="" and collide on the unique constraint. The
            # pk is unique by construction, so it is a safe placeholder until
            # ReelSerializer._finalize replaces it with the real one.
            #
            # A queryset .update(), not self.save(): this placeholder is
            # bookkeeping between the insert above and _finalize's own save
            # moments later in the SAME request, and calling .save() here
            # would fire post_save (see signals.py) a second time for a reel
            # that has neither its title nor its poster yet.
            self.slug = f"reel-{self.pk}"
            Reel.objects.filter(pk=self.pk).update(slug=self.slug)

    def __str__(self):
        return self.title or self.url


class VideoComment(models.Model):
    """
    Moderation queue row for a video's comment thread — same posture as
    content.Comment: a reader may submit without an account, but the row
    isn't shown on the public video page until staff approve it (see
    VideoCommentViewSet.perform_create and VideoDetailSerializer.get_comments).
    """

    class Status(models.TextChoices):
        PENDING = "pending", "معلّق"
        APPROVED = "approved", "مقبول"
        BANNED = "banned", "محظور"

    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name="comments")
    name = models.CharField(max_length=80, default="زائر")
    initial = models.CharField(max_length=2, blank=True)
    text = models.TextField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.initial:
            self.initial = (self.name or "?")[:1]
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name}: {self.text[:30]}"
