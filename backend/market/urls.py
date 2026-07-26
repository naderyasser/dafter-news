from rest_framework.routers import DefaultRouter

from django.urls import path

from .views import CurrencyViewSet, GoldKaratViewSet, TickerModuleViewSet, TickerView, WeatherCityViewSet

router = DefaultRouter()
router.register("currencies", CurrencyViewSet, basename="currency")
router.register("gold", GoldKaratViewSet, basename="gold-karat")
router.register("weather-cities", WeatherCityViewSet, basename="weather-city")
router.register("ticker-modules", TickerModuleViewSet, basename="ticker-module")

urlpatterns = router.urls + [
    path("ticker/", TickerView.as_view(), name="ticker"),
]
