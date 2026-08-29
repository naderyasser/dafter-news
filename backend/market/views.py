from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from aldaftar.permissions import ReadOnlyOrEditor
from .models import Currency, GoldKarat, TickerModule, WeatherCity
from .serializers import (
    CurrencySerializer,
    GoldKaratSerializer,
    TickerModuleSerializer,
    WeatherCitySerializer,
)


class CurrencyViewSet(viewsets.ModelViewSet):
    queryset = Currency.objects.all()
    serializer_class = CurrencySerializer
    permission_classes = [ReadOnlyOrEditor]


class GoldKaratViewSet(viewsets.ModelViewSet):
    queryset = GoldKarat.objects.all()
    serializer_class = GoldKaratSerializer
    permission_classes = [ReadOnlyOrEditor]


class WeatherCityViewSet(viewsets.ModelViewSet):
    queryset = WeatherCity.objects.all()
    serializer_class = WeatherCitySerializer
    permission_classes = [ReadOnlyOrEditor]
    lookup_field = "key"


class TickerModuleViewSet(viewsets.ModelViewSet):
    """DashTicker.dc.html — module visibility/order/source."""

    queryset = TickerModule.objects.all()
    serializer_class = TickerModuleSerializer
    permission_classes = [ReadOnlyOrEditor]
    ordering_fields = ["order"]


class TickerView(APIView):
    """
    GET /api/ticker/ — single combined endpoint per brief §11: feeds the
    sticky MarketsTicker on every public page, the Markets.dc.html page,
    and the stat cards, all from one payload refreshed every minute.
    """

    permission_classes = [ReadOnlyOrEditor]

    def get(self, request):
        city_key = request.query_params.get("city", "cairo")
        weather = WeatherCity.objects.filter(key=city_key).first() or WeatherCity.objects.first()
        return Response({
            "currencies": CurrencySerializer(Currency.objects.all(), many=True).data,
            "gold": GoldKaratSerializer(GoldKarat.objects.all(), many=True).data,
            "weather": WeatherCitySerializer(weather).data if weather else None,
            "cities": WeatherCitySerializer(WeatherCity.objects.all(), many=True).data,
            "modules": TickerModuleSerializer(TickerModule.objects.filter(active=True), many=True).data,
        })
