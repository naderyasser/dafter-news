from django.db import models


class Currency(models.Model):
    """Markets.dc.html currency table row. Sparkline is derived from `series`."""

    flag_emoji = models.CharField(max_length=8, default="🏳")
    code = models.CharField(max_length=6, help_text="USD / EUR / GBP / SAR")
    buy = models.DecimalField(max_digits=10, decimal_places=2)
    sell = models.DecimalField(max_digits=10, decimal_places=2)
    change_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    is_up = models.BooleanField(default=True)
    series = models.JSONField(default=list, blank=True, help_text="آخر 8 قراءات لرسم الـsparkline")
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        verbose_name_plural = "currencies"

    def __str__(self):
        return self.code


class GoldKarat(models.Model):
    label = models.CharField(max_length=40, help_text="عيار 24 / عيار 21 / عيار 18 / جنيه ذهب")
    price = models.DecimalField(max_digits=10, decimal_places=2)
    change_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    is_up = models.BooleanField(default=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.label


class WeatherCity(models.Model):
    key = models.SlugField(max_length=30, unique=True, help_text="cairo / alex / luxor / aswan")
    label = models.CharField(max_length=40)
    icon = models.CharField(max_length=8, default="☀️")
    temp = models.SmallIntegerField()
    hi = models.SmallIntegerField()
    lo = models.SmallIntegerField()
    humidity = models.PositiveSmallIntegerField()
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        verbose_name_plural = "weather cities"

    def __str__(self):
        return self.label


class TickerModule(models.Model):
    """DashTicker.dc.html visibility/order/source toggles for the sticky bar."""

    key = models.SlugField(max_length=30, unique=True, help_text="currencies / gold / index / weather / oil")
    label = models.CharField(max_length=60)
    source = models.CharField(max_length=120, blank=True)
    active = models.BooleanField(default=True)
    order = models.PositiveSmallIntegerField(default=0)
    # How often the public ticker re-fetches this module. Per-module rather
    # than one global setting: gold and currencies move on different clocks
    # from the weather, and polling all of them at the fastest rate is wasted
    # traffic. Floor of 15s so a mistyped value can't hammer the API.
    refresh_seconds = models.PositiveIntegerField(
        default=60, help_text="زمن إعادة جلب البيانات بالثواني (15 على الأقل)"
    )

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.label
