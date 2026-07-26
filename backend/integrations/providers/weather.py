"""
Weather for the four ticker cities.

Two backends:

* **OpenWeatherMap** (default) — needs a key, and its free tier permits
  commercial use at 60 calls/minute. Four cities on a ten-minute cadence is
  ~576 calls/day, comfortably inside it.
* **Open-Meteo** — keyless, so the site shows real weather the moment you
  clone it. Opt in with WEATHER_PROVIDER=open-meteo.

  ⚠️ Open-Meteo's free tier is licensed for NON-COMMERCIAL use only. It is
  fine for development and staging; a live aldaftarnews.com needs either an
  OpenWeatherMap key or a paid Open-Meteo plan. That's why it is never the
  default — switching to it has to be a deliberate act by the operator, not
  something that happens because a key was missing.
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


OPEN_METEO_ENDPOINT = "https://api.open-meteo.com/v1/forecast"

# WMO weather codes (Open-Meteo) → the same emoji set, so the ticker looks
# identical whichever backend is in use.
def _icon_for_wmo(code, is_day=1):
    if code == 0:
        return "☀️" if is_day else "🌙"
    if code in (1, 2):
        return "⛅"
    if code == 3:
        return "☁️"
    if code in (45, 48):
        return "🌫️"
    if 51 <= code <= 67 or 80 <= code <= 82:
        return "🌧️"
    if 71 <= code <= 77 or code in (85, 86):
        return "❄️"
    if code >= 95:
        return "⛈️"
    return "☀️"


def _fetch_owm(lat, lon, api_key):
    data = fetch_json(
        ENDPOINT, params={"lat": lat, "lon": lon, "units": "metric", "lang": "ar", "appid": api_key}
    )
    if not data or "main" not in data:
        return None
    main = data["main"]
    weather = (data.get("weather") or [{}])[0]
    return dict(
        icon=_icon_for(weather.get("id", 800), weather.get("icon", "")),
        temp=round(main.get("temp", 0)),
        hi=round(main.get("temp_max", main.get("temp", 0))),
        lo=round(main.get("temp_min", main.get("temp", 0))),
        humidity=round(main.get("humidity", 0)),
    )


def _fetch_open_meteo(lat, lon):
    data = fetch_json(
        OPEN_METEO_ENDPOINT,
        params={
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,weather_code,is_day",
            "daily": "temperature_2m_max,temperature_2m_min",
            "timezone": "Africa/Cairo",
            "forecast_days": 1,
        },
    )
    if not data or "current" not in data:
        return None
    current = data["current"]
    daily = data.get("daily") or {}

    def first(seq, fallback):
        return seq[0] if isinstance(seq, list) and seq else fallback

    temp = current.get("temperature_2m", 0)
    return dict(
        icon=_icon_for_wmo(current.get("weather_code", 0), current.get("is_day", 1)),
        temp=round(temp),
        hi=round(first(daily.get("temperature_2m_max"), temp)),
        lo=round(first(daily.get("temperature_2m_min"), temp)),
        humidity=round(current.get("relative_humidity_2m", 0)),
    )


def sync():
    """Refresh every city. Returns the number of cities actually updated."""
    backend = os.environ.get("WEATHER_PROVIDER", "openweathermap").strip().lower()
    api_key = os.environ.get("OPENWEATHER_API_KEY") or getattr(settings, "OPENWEATHER_API_KEY", "")

    if backend in ("open-meteo", "openmeteo"):
        fetch_city = _fetch_open_meteo
    else:
        if not api_key:
            raise ProviderError(
                "OPENWEATHER_API_KEY غير مضبوط — أو استخدم WEATHER_PROVIDER=open-meteo "
                "(بدون مفتاح، لكن ترخيصه غير تجاري)"
            )
        fetch_city = lambda lat, lon: _fetch_owm(lat, lon, api_key)  # noqa: E731

    updated = 0
    failures = []
    for order, (key, (label, lat, lon)) in enumerate(CITIES.items(), start=1):
        reading = fetch_city(lat, lon)
        if not reading:
            failures.append(key)
            continue

        WeatherCity.objects.update_or_create(key=key, defaults=dict(label=label, order=order, **reading))
        updated += 1

    # Partial success still counts: three cities refreshed and one stale is
    # better than discarding all four because one lookup blipped.
    if not updated:
        raise ProviderError(f"تعذّر تحديث أي مدينة ({', '.join(failures)})")
    return updated
