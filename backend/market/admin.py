from django.contrib import admin

from .models import Currency, GoldKarat, TickerModule, WeatherCity


@admin.register(Currency)
class CurrencyAdmin(admin.ModelAdmin):
    list_display = ("code", "buy", "sell", "change_pct", "is_up", "order")
    list_editable = ("order",)


@admin.register(GoldKarat)
class GoldKaratAdmin(admin.ModelAdmin):
    list_display = ("label", "price", "change_pct", "is_up", "order")


@admin.register(WeatherCity)
class WeatherCityAdmin(admin.ModelAdmin):
    list_display = ("label", "key", "temp", "hi", "lo", "humidity")


@admin.register(TickerModule)
class TickerModuleAdmin(admin.ModelAdmin):
    list_display = ("label", "key", "source", "active", "order")
    list_editable = ("active", "order")
