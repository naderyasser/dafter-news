from django.db import models


class AdPlacement(models.Model):
    """DashAds.dc.html row — أعلى الهيدر / داخل متن المقال / الشريط الجانبي / بين بلوكات القسم."""

    name = models.CharField(max_length=120)
    size = models.CharField(max_length=20, help_text="728×90")
    active = models.BooleanField(default=True)
    impressions = models.PositiveIntegerField(default=0)
    clicks = models.PositiveIntegerField(default=0)
    order = models.PositiveSmallIntegerField(default=0)
    scheduled_start = models.DateTimeField(null=True, blank=True)
    scheduled_end = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.name} ({self.size})"

    @property
    def ctr(self):
        if not self.impressions:
            return 0.0
        return round((self.clicks / self.impressions) * 100, 2)
