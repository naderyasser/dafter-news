from rest_framework import serializers

from .models import Currency, GoldKarat, TickerModule, WeatherCity


class CurrencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Currency
        fields = ["id", "flag_emoji", "code", "buy", "sell", "change_pct", "is_up", "series", "order"]


class GoldKaratSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoldKarat
        fields = ["id", "label", "price", "change_pct", "is_up", "order"]


class WeatherCitySerializer(serializers.ModelSerializer):
    class Meta:
        model = WeatherCity
        fields = ["id", "key", "label", "icon", "temp", "hi", "lo", "humidity", "order"]


class TickerModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = TickerModule
        fields = ["id", "key", "label", "source", "active", "order", "refresh_seconds"]

    def validate_refresh_seconds(self, value):
        # Mirrors the model's documented floor — without it a 1s interval from
        # the dashboard would have every open tab polling the API once a
        # second.
        if value < 15:
            raise serializers.ValidationError("أقل زمن تحديث مسموح به 15 ثانية.")
        return value
