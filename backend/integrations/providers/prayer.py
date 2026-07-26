"""
Prayer times and the Hijri date (AlAdhan).

Keyless, free, and no commercial restriction — and for an Egyptian audience
مواقيت الصلاة in the header is table stakes rather than a nice-to-have.

Method 5 is the Egyptian General Authority of Survey, the calculation
Egyptian mosques actually follow; using the API's default would put the site
a few minutes out from the adhan people can hear outside.
"""
from datetime import datetime, timezone as dt_timezone

from django.utils import timezone

from integrations.client import ProviderError, fetch_json
from integrations.models import PrayerTimes

SOURCE = "prayer"
LABEL = "مواقيت الصلاة — AlAdhan"
ENDPOINT = "https://api.aladhan.com/v1/timings"

EGYPT_METHOD = 5  # Egyptian General Authority of Survey

CITIES = {
    "cairo": (30.0444, 31.2357),
    "alex": (31.2001, 29.9187),
    "luxor": (25.6872, 32.6396),
    "aswan": (24.0889, 32.8998),
}

AR_MONTHS = {
    1: "محرم", 2: "صفر", 3: "ربيع الأول", 4: "ربيع الآخر", 5: "جمادى الأولى", 6: "جمادى الآخرة",
    7: "رجب", 8: "شعبان", 9: "رمضان", 10: "شوال", 11: "ذو القعدة", 12: "ذو الحجة",
}


def _clock(value):
    """AlAdhan appends a timezone note, e.g. '04:52 (EET)'."""
    return (value or "").split(" ")[0][:8]


def sync():
    """Refresh today's timings for each city. Returns cities updated."""
    today = timezone.localdate()
    stamp = today.strftime("%d-%m-%Y")

    updated = 0
    for key, (lat, lon) in CITIES.items():
        data = fetch_json(
            f"{ENDPOINT}/{stamp}",
            params={"latitude": lat, "longitude": lon, "method": EGYPT_METHOD},
        )
        if not data or data.get("code") != 200:
            continue

        payload = data.get("data") or {}
        timings = payload.get("timings") or {}
        hijri = (payload.get("date") or {}).get("hijri") or {}

        month_num = None
        try:
            month_num = int((hijri.get("month") or {}).get("number"))
        except (TypeError, ValueError):
            pass
        month_ar = AR_MONTHS.get(month_num) or (hijri.get("month") or {}).get("ar", "")
        hijri_label = " ".join(part for part in [hijri.get("day", ""), month_ar, hijri.get("year", "")] if part)

        PrayerTimes.objects.update_or_create(
            city_key=key,
            date=today,
            defaults=dict(
                hijri_date=hijri_label.strip()[:60],
                fajr=_clock(timings.get("Fajr")),
                dhuhr=_clock(timings.get("Dhuhr")),
                asr=_clock(timings.get("Asr")),
                maghrib=_clock(timings.get("Maghrib")),
                isha=_clock(timings.get("Isha")),
            ),
        )
        updated += 1

    if not updated:
        raise ProviderError("تعذّر تحديث مواقيت الصلاة لأي مدينة")

    # Yesterday's rows are dead weight; the header only ever reads today.
    PrayerTimes.objects.filter(date__lt=today).delete()
    return updated
