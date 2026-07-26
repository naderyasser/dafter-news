from django.db import models


class SiteSettings(models.Model):
    """
    Singleton — DashSettings.dc.html (هوية الموقع / SEO / اللغات).
    Enforced as a singleton via pk=1 in save().
    """

    site_name = models.CharField(max_length=80, default="الدفتر نيوز")
    tagline = models.CharField(max_length=140, default="سِجلّ اليوم.. خبراً خبراً")
    logo = models.ImageField(upload_to="branding/", blank=True, null=True)
    seo_title = models.CharField(max_length=140, blank=True)
    seo_description = models.CharField(max_length=300, blank=True)
    lang_ar_enabled = models.BooleanField(default=True)
    lang_en_enabled = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        self.pk = 1
        # Pinning the pk means a second objects.create() would try to INSERT
        # over an existing row and raise IntegrityError instead of behaving
        # like the singleton it claims to be — drop the forced insert so the
        # write always lands as an upsert on row 1.
        kwargs.pop("force_insert", None)
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return self.site_name

    class Meta:
        verbose_name_plural = "site settings"


class SocialLink(models.Model):
    class Platform(models.TextChoices):
        FACEBOOK = "facebook", "فيسبوك"
        X = "x", "X"
        INSTAGRAM = "instagram", "إنستغرام"
        YOUTUBE = "youtube", "يوتيوب"

    platform = models.CharField(max_length=20, choices=Platform.choices, unique=True)
    url = models.URLField(blank=True)

    def __str__(self):
        return f"{self.get_platform_display()}: {self.url}"


class DailyVisit(models.Model):
    """Backs the DashOverview.dc.html 7-day chart and «زيارات اليوم» stat."""

    date = models.DateField(unique=True)
    visits = models.PositiveIntegerField(default=0)
    change_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.date}: {self.visits}"
