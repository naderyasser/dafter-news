from django.db import models


class MediaAsset(models.Model):
    """DashMedia.dc.html library grid item."""

    class License(models.TextChoices):
        OWNED = "owned", "ملكية الدفتر"
        AGENCY = "agency", "وكالة"
        CREATIVE_COMMONS = "cc", "المشاع الإبداعي"
        PERMISSION = "permission", "بإذن الناشر"
        UNKNOWN = "unknown", "غير محدد"

    image = models.ImageField(upload_to="library/")
    # `alt` stays the accessibility text; `title` is the human label the
    # library grid and its search box work with. They were the same field
    # before, which meant naming an asset also rewrote what a screen reader
    # announced for it.
    title = models.CharField(max_length=200, blank=True)
    alt = models.CharField(max_length=200, blank=True)
    credit = models.CharField(max_length=120, blank=True)
    license = models.CharField(max_length=20, choices=License.choices, default=License.UNKNOWN)
    source = models.CharField(max_length=200, blank=True, help_text="الجهة أو الرابط الذي جاءت منه الصورة")
    # Where this asset is used. SET_NULL rather than CASCADE: deleting an
    # article shouldn't silently delete the photo out of the library, which
    # may be reused elsewhere.
    article = models.ForeignKey(
        "content.Article", on_delete=models.SET_NULL, null=True, blank=True, related_name="media_assets",
        help_text="الخبر المرتبط — الضغط على الصورة في اللوحة يفتحه",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title or self.alt or f"Asset #{self.pk}"
