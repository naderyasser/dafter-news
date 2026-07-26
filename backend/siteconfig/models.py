from django.conf import settings
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


class WelcomeAlert(models.Model):
    """
    Singleton — the modal shown on first load, styled like a «يحدث الآن»
    banner. Editorial controls the copy and destination, so it can be
    repointed at whatever is breaking without a deploy; `active` switches it
    off entirely rather than requiring the copy to be blanked.
    """

    active = models.BooleanField(default=False)
    kicker = models.CharField(max_length=40, default="يحدث الآن")
    title = models.CharField(max_length=160, blank=True)
    text = models.CharField(max_length=400, blank=True)
    cta_label = models.CharField(max_length=60, blank=True)
    cta_href = models.CharField(max_length=300, blank=True)
    image = models.ImageField(upload_to="alerts/", blank=True, null=True)

    def save(self, *args, **kwargs):
        self.pk = 1
        kwargs.pop("force_insert", None)
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return self.title or "welcome alert"

    class Meta:
        verbose_name_plural = "welcome alert"


class DailyVisit(models.Model):
    """Backs the DashOverview.dc.html 7-day chart and «زيارات اليوم» stat."""

    date = models.DateField(unique=True)
    visits = models.PositiveIntegerField(default=0)
    change_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.date}: {self.visits}"


class PushSubscription(models.Model):
    """
    A browser that agreed to receive «عاجل» alerts.

    Keyed by endpoint because that is what the Push API gives back and what
    uniquely identifies the browser+profile; a reader on three devices is
    three rows. `user` is optional — alerts are opt-in, not account-gated.
    """

    endpoint = models.URLField(max_length=500, unique=True)
    p256dh = models.CharField(max_length=200)
    auth = models.CharField(max_length=100)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="push_subscriptions"
    )
    user_agent = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_sent_at = models.DateTimeField(null=True, blank=True)
    failure_count = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.endpoint[:60]

    def as_push_info(self):
        return {"endpoint": self.endpoint, "keys": {"p256dh": self.p256dh, "auth": self.auth}}
