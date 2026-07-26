from django.db import models
from django.utils import timezone


class SyncLog(models.Model):
    """
    One row per external source, recording the outcome of its last refresh.

    The point is answering "is what the ticker is showing actually current?".
    A failed fetch deliberately leaves the previous prices in place — a bar
    showing yesterday's dollar rate is recoverable, a bar showing nothing
    looks broken to every visitor — so without this record there'd be no way
    to tell fresh data from stale.
    """

    class Status(models.TextChoices):
        OK = "ok", "نجح"
        FAILED = "failed", "فشل"
        SKIPPED = "skipped", "متخطى"

    source = models.SlugField(max_length=40, unique=True)
    label = models.CharField(max_length=80)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.SKIPPED)
    message = models.CharField(max_length=300, blank=True)
    records = models.PositiveIntegerField(default=0, help_text="عدد السجلات المحدَّثة في آخر تشغيل")
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    last_success_at = models.DateTimeField(null=True, blank=True)
    consecutive_failures = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["source"]

    def __str__(self):
        return f"{self.source}: {self.status}"

    @property
    def is_stale(self):
        """True once the data is old enough that it shouldn't be trusted.

        Thirty minutes is well past the one-minute refresh cadence, so this
        only trips on a genuinely stuck source, not on a single missed run."""
        if not self.last_success_at:
            return True
        return (timezone.now() - self.last_success_at).total_seconds() > 1800

    @classmethod
    def record_success(cls, source, label, records=0, message=""):
        now = timezone.now()
        obj, _ = cls.objects.update_or_create(
            source=source,
            defaults=dict(
                label=label, status=cls.Status.OK, message=message, records=records,
                last_attempt_at=now, last_success_at=now, consecutive_failures=0,
            ),
        )
        return obj

    @classmethod
    def record_failure(cls, source, label, message):
        now = timezone.now()
        existing = cls.objects.filter(source=source).first()
        failures = (existing.consecutive_failures if existing else 0) + 1
        obj, _ = cls.objects.update_or_create(
            source=source,
            defaults=dict(
                label=label, status=cls.Status.FAILED, message=str(message)[:300],
                last_attempt_at=now, consecutive_failures=failures,
                # last_success_at is deliberately untouched: it's how we know
                # how old the data still on screen actually is.
                last_success_at=existing.last_success_at if existing else None,
                records=existing.records if existing else 0,
            ),
        )
        return obj


class WireArticle(models.Model):
    """
    A story pulled from an external news wire.

    Kept out of the Article table on purpose: these aren't ours to publish.
    They feed a "من حول العالم" rail and the newsroom dashboard, so an editor
    consciously writes their own piece rather than wire copy silently
    appearing as الدفتر نيوز content.
    """

    external_id = models.CharField(max_length=200, unique=True)
    title = models.CharField(max_length=400)
    summary = models.TextField(blank=True)
    url = models.URLField(max_length=600)
    image_url = models.URLField(max_length=600, blank=True)
    source_name = models.CharField(max_length=120, blank=True)
    provider = models.SlugField(max_length=40)
    language = models.CharField(max_length=8, default="ar")
    published_at = models.DateTimeField(null=True, blank=True)
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-published_at", "-fetched_at"]

    def __str__(self):
        return self.title


class Match(models.Model):
    """Egyptian Premier League fixture/result from the sports feed."""

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "قادمة"
        LIVE = "live", "جارية"
        FINISHED = "finished", "انتهت"

    external_id = models.CharField(max_length=80, unique=True)
    league = models.CharField(max_length=120, default="الدوري المصري الممتاز")
    home_team = models.CharField(max_length=120)
    away_team = models.CharField(max_length=120)
    home_score = models.SmallIntegerField(null=True, blank=True)
    away_score = models.SmallIntegerField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.SCHEDULED)
    kickoff_at = models.DateTimeField(null=True, blank=True)
    round_label = models.CharField(max_length=60, blank=True)
    venue = models.CharField(max_length=160, blank=True)

    class Meta:
        ordering = ["-kickoff_at"]
        verbose_name_plural = "matches"

    def __str__(self):
        return f"{self.home_team} × {self.away_team}"

    @property
    def score_label(self):
        """Dash rather than 0-0 before kickoff — an unplayed match has no
        score, and zeros read as a goalless draw."""
        if self.home_score is None or self.away_score is None:
            return "—"
        return f"{self.home_score} - {self.away_score}"


class PrayerTimes(models.Model):
    """Daily prayer times + Hijri date for one city (AlAdhan)."""

    city_key = models.SlugField(max_length=30)
    date = models.DateField()
    hijri_date = models.CharField(max_length=60, blank=True)
    fajr = models.CharField(max_length=8, blank=True)
    dhuhr = models.CharField(max_length=8, blank=True)
    asr = models.CharField(max_length=8, blank=True)
    maghrib = models.CharField(max_length=8, blank=True)
    isha = models.CharField(max_length=8, blank=True)

    class Meta:
        ordering = ["-date"]
        unique_together = [("city_key", "date")]
        verbose_name_plural = "prayer times"

    def __str__(self):
        return f"{self.city_key} {self.date}"
