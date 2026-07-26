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
        fields = ["id", "key", "label", "source", "active", "order"]
