from django.db import models


class Video(models.Model):
    """لقطة وتعليق — VideoList.dc.html / VideoPage.dc.html / DashVideos.dc.html."""

    title = models.CharField(max_length=280)
    slug = models.SlugField(max_length=300, unique=True)
    section = models.ForeignKey("content.Section", on_delete=models.SET_NULL, null=True, blank=True, related_name="videos")
    description = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to="video_covers/", blank=True, null=True)
    file = models.FileField(upload_to="videos/", blank=True, null=True)
    duration_seconds = models.PositiveIntegerField(default=0)
    is_live = models.BooleanField(default=False)
    is_exclusive = models.BooleanField(default=False)
    views = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    @property
    def duration_label(self):
        if self.is_live or not self.duration_seconds:
            return "—"
        m, s = divmod(self.duration_seconds, 60)
        return f"{m:02d}:{s:02d}"


class VideoComment(models.Model):
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name="comments")
    name = models.CharField(max_length=80, default="زائر")
    initial = models.CharField(max_length=2, blank=True)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.initial:
            self.initial = (self.name or "?")[:1]
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name}: {self.text[:30]}"
