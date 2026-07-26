from django.db import models


class MediaAsset(models.Model):
    """DashMedia.dc.html library grid item."""

    image = models.ImageField(upload_to="library/")
    alt = models.CharField(max_length=200, blank=True)
    credit = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.alt or f"Asset #{self.pk}"
