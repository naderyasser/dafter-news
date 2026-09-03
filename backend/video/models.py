from django.db import models
from django.utils.text import slugify

#: How much of a title a REEL's own slug keeps.
#:
#: Deliberately NOT the same convention Article/Video use (see
#: Reel.assign_slug's own docstring for why this can't just be their
#: save()-on-every-row pattern either way) — those keep effectively the
#: whole headline, capped only at 290 characters, which is fine for a slug a
#: reader never looks at closely on an article page. A reel's slug is
#: different: it is the visible destination printed on the homepage card AND
#: the thing a reader actually shares (see ReelPlayer's Share button, which
#: shares the Facebook link rather than this URL, but the reel's OWN page
#: still needs to read as a real address rather than a full sentence). A
#: scraped og:title is very often a full sentence, and the un-truncated
#: version of one turns into a wall of percent-encoded Arabic the instant it
#: is copied into a WhatsApp share sheet — exactly the "massive, unreadable
#: URL" the newsroom reported. Six words or fifty characters, whichever
#: comes first, is short enough to read as an address and still say
#: something recognisable about the reel it points to.
REEL_SLUG_MAX_WORDS = 6
REEL_SLUG_MAX_CHARS = 50


def short_slug_base(title: str) -> str:
    """
    A slugified, word-and-length-capped base for a Reel's slug — not yet
    made unique (see Reel.assign_slug, which appends the -2/-3 suffix).

    A plain module-level function, not a method, so the migration that
    recalculates every existing reel's slug to this shape (see
    video/migrations/0007_reel_slug_shorten.py) can import and reuse this
    EXACT logic against its own frozen historical model, rather than a
    second hand-copied version silently drifting from this one over time.

    Django's own `slugify(allow_unicode=True)` already drops emoji,
    punctuation and extra whitespace before this ever sees the result (it
    keeps only word characters and hyphens) — confirmed against a real
    scraped title carrying both: "صرف مستشفى العامرية 🔥😱 بالإسكندرية"
    slugifies straight to "صرف-مستشفى-العامرية-بالإسكندرية", already emoji-
    free. This only adds the word/character cap on top of that; it does not
    need to strip anything by hand.
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

    # `.strip("-")` guards the case that produced the "trailing dashes"
    # complaint: cutting the word list short can leave nothing behind it,
    # but never a stray separator, so this is defensive rather than load-
    # bearing given `kept` only ever holds whole words already.
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
    «بالمختصر» — a vertical shorts shelf on the home page.

    Originally built to deliberately NOT play here at all — the client's
    first brief was a traffic one, a poster whose only job was to open the
    reel on the paper's Facebook page, with no page of its own on this site.
    That brief moved: the client asked first for the reel to play inline,
    then for a proper lightbox player, then explicitly for an Asharq-style
    dedicated watch page (a real, shareable, indexable URL per reel — see
    `slug` below). This model has grown to match each step rather than being
    rewritten from scratch, which is why the comments in this file still
    narrate that history in places — it is what actually happened to this
    feature, not a design mistake to paper over.

    `title` and `thumbnail` are both populated from `facebook_url` itself
    (video/og.py) rather than typed by an editor — the field an editor
    actually fills in is the link alone, with the other two writable only as
    an override.

    Ordering: `order` first so the desk can pin a reel to the head of the rail,
    then newest. Both are set by the dashboard, neither is asked of the editor
    on the upload form — `order` defaults to 0, which leaves the rail purely
    chronological until someone deliberately reorders it.
    """

    # blank=True: the dashboard's add form asks for only the Facebook link now
    # — the title is scraped from that link's own page (see video/og.py and
    # ReelSerializer). A blank submission is the normal path, not an edge
    # case, so the model has to agree, or the Django admin's own add form
    # (a second write path onto this same table) would demand a field the
    # newsroom is no longer shown.
    title = models.CharField(max_length=200, blank=True)
    # Also blank on write, same reasoning as Video/Article — but UNLIKE
    # either of them, this is deliberately NOT auto-derived in save() on
    # every row. See assign_slug()'s own docstring for why: a reel's title
    # is not known yet at its own first save.
    slug = models.SlugField(max_length=300, unique=True, allow_unicode=True, blank=True)
    thumbnail = models.ImageField(upload_to="reels/", blank=True, null=True)
    # A URLField, not a plain CharField: a mistyped link here is a dead card on
    # the home page, and it is the ONLY thing the card does.
    facebook_url = models.URLField(
        max_length=500,
        help_text="رابط الريل على فيسبوك — البطاقة تفتحه في تبويب جديد",
    )
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "-created_at"]

    def assign_slug(self):
        """
        Derive this reel's slug from its CURRENT title, guaranteed unique
        against every other reel.

        Not wired into save() the way Video.save()/Article.save() auto-slug
        every row — those always know their real title at the very first
        save, because an editor types it before anything is written at all.
        A reel does not: ReelSerializer.create() saves the row first, THEN
        scrapes the title off Facebook a moment later (video/og.py), so
        slugifying automatically on that first save would freeze the slug
        against a title that is still blank. This is called explicitly once
        the title is actually settled instead — see ReelSerializer._finalize.
        """
        base = short_slug_base(self.title)
        slug = base
        n = 2
        while Reel.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug = f"{base}-{n}"
            n += 1
        self.slug = slug

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        super().save(*args, **kwargs)
        if is_new and not self.slug:
            # A brand-new row needs SOME unique slug the instant it exists,
            # title or no title — two reels created moments apart, both
            # still mid-scrape with a blank title, would otherwise both try
            # to persist slug="" and collide on the unique constraint. The
            # row's own freshly-assigned pk is unique by construction, so it
            # is a safe placeholder until ReelSerializer._finalize replaces
            # it with one actually derived from the title.
            self.slug = f"reel-{self.pk}"
            # A queryset .update(), not self.save(update_fields=["slug"]):
            # this placeholder is purely internal bookkeeping between the
            # insert above and _finalize's own save moments later in the
            # SAME request, never a state worth telling the world about —
            # calling .save() here would fire post_save (see signals.py) a
            # second time for a reel that has neither its real title, its
            # thumbnail, nor its real slug yet, flushing the home page's
            # cache a beat before there is anything new worth showing on it.
            # .update() writes straight to the row with no signal at all.
            Reel.objects.filter(pk=self.pk).update(slug=self.slug)

    def __str__(self):
        return self.title


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
