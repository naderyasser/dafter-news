"""
Weather for the four ticker cities.

OpenWeatherMap rather than Open-Meteo: Open-Meteo's free tier is licensed
for non-commercial use only, and aldaftarnews.com is a commercial site.
OWM's free tier allows commercial use at 60 calls/minute — four cities on a
ten-minute cadence is ~576 calls/day, comfortably inside it.
"""
import os

from django.conf import settings

from integrations.client import ProviderError, fetch_json
from market.models import WeatherCity

SOURCE = "weather"
LABEL = "الطقس — OpenWeatherMap"
ENDPOINT = "https://api.openweathermap.org/data/2.5/weather"

# lat/lon rather than city names: OWM's name search is ambiguous for Arabic
# cities (several "Aswan"s worldwide) and coordinates never drift.
CITIES = {
    "cairo": ("القاهرة", 30.0444, 31.2357),
    "alex": ("الإسكندرية", 31.2001, 29.9187),
    "luxor": ("الأقصر", 25.6872, 32.6396),
    "aswan": ("أسوان", 24.0889, 32.8998),
}

# OWM condition code → the emoji the ticker already renders. Ranges follow
# the documented groups (2xx storm, 3xx drizzle, 5xx rain, 6xx snow, 7xx
# atmosphere, 800 clear, 80x clouds).
def _icon_for(code, icon_id=""):
    if code == 800:
        return "🌙" if icon_id.endswith("n") else "☀️"
    if 801 <= code <= 802:
        return "⛅"
    if 803 <= code <= 804:
        return "☁️"
    if 200 <= code < 300:
        return "⛈️"
    if 300 <= code < 400 or 500 <= code < 600:
        return "🌧️"
    if 600 <= code < 700:
        return "❄️"
    if code in (701, 741):
        return "🌫️"
    if code in (731, 751, 761, 762):
        return "🌪️"
    return "☀️"


def sync():
    """Refresh every city. Returns the number of cities actually updated."""
    api_key = os.environ.get("OPENWEATHER_API_KEY") or getattr(settings, "OPENWEATHER_API_KEY", "")
    if not api_key:
        raise ProviderError("OPENWEATHER_API_KEY غير مضبوط")

    updated = 0
    failures = []
    for order, (key, (label, lat, lon)) in enumerate(CITIES.items(), start=1):
        data = fetch_json(
            ENDPOINT,
            params={"lat": lat, "lon": lon, "units": "metric", "lang": "ar", "appid": api_key},
        )
        if not data or "main" not in data:
            failures.append(key)
            continue

        main = data["main"]
        weather = (data.get("weather") or [{}])[0]
        WeatherCity.objects.update_or_create(
            key=key,
            defaults=dict(
                label=label,
                icon=_icon_for(weather.get("id", 800), weather.get("icon", "")),
                temp=round(main.get("temp", 0)),
                hi=round(main.get("temp_max", main.get("temp", 0))),
                lo=round(main.get("temp_min", main.get("temp", 0))),
                humidity=round(main.get("humidity", 0)),
                order=order,
            ),
        )
        updated += 1

    # Partial success still counts: three cities refreshed and one stale is
    # better than discarding all four because one lookup blipped.
    if not updated:
        raise ProviderError(f"تعذّر تحديث أي مدينة ({', '.join(failures)})")
    return updated
