from django.db import models
from django.utils.text import slugify


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
