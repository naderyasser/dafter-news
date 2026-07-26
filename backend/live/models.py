from django.db import models


class LiveStream(models.Model):
    """بث مباشر / تغطية لحظية — Live.dc.html / DashLive.dc.html."""

    title = models.CharField(max_length=280, help_text='مثال: "تغطية لحظية: مؤتمر البنك المركزي حول أسعار الفائدة"')
    is_live = models.BooleanField(default=False)
    cover_image = models.ImageField(upload_to="live_covers/", blank=True, null=True)
    stream_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class LiveUpdate(models.Model):
    """One «التغطية لحظة بلحظة» timeline entry."""

    stream = models.ForeignKey(LiveStream, on_delete=models.CASCADE, related_name="updates")
    time_label = models.CharField(max_length=10, help_text="HH:MM، مثال 12:41")
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.time_label} — {self.text[:40]}"
