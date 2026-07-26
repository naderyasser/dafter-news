"""
Gold prices per gram in Egyptian pounds, by karat.

The design shows عيار 24 / 21 / 18 / جنيه ذهب — Egyptian retail units. Free
metals feeds quote the international spot price of one troy ounce of pure
(24k) gold, so the conversion has to happen here:

    price per gram 24k = spot_per_ounce / 31.1034768
    price per gram Nk  = price per gram 24k × (N / 24)
    جنيه ذهب (8g of 21k) = price per gram 21k × 8

That last one is a specifically Egyptian unit: a "gold pound" coin is 8
grams of 21-karat gold, which is why it isn't just a karat row.

Spot is quoted in USD, so the USD/EGP rate is read from the currency table
that the currency provider maintains — meaning gold sync depends on currency
sync having run at least once.
"""
import os

from integrations.client import ProviderError, fetch_json, pct_change
from market.models import Currency, GoldKarat

SOURCE = "gold"
LABEL = "الذهب — gold-api.com"
ENDPOINT = "https://api.gold-api.com/price/XAU"

GRAMS_PER_TROY_OUNCE = 31.1034768
GOLD_POUND_GRAMS = 8  # جنيه ذهب = 8g of 21k

KARATS = [
    ("عيار 24", 24, 1),
    ("عيار 21", 21, 2),
    ("عيار 18", 18, 3),
]


def _usd_to_egp():
    """USD/EGP from our own currency table, so both feeds agree.

    Falls back to the env override when the table hasn't been populated yet
    (first boot, before the currency sync has run)."""
    usd = Currency.objects.filter(code="USD").first()
    if usd and usd.sell:
        return float(usd.sell)
    fallback = os.environ.get("USD_EGP_FALLBACK")
    if fallback:
        try:
            return float(fallback)
        except ValueError:
            pass
    return None


def sync():
    """Refresh karat rows. Returns rows updated."""
    rate = _usd_to_egp()
    if not rate:
        raise ProviderError("سعر الدولار غير متاح بعد — شغّل مزامنة العملات أولاً")

    data = fetch_json(ENDPOINT)
    if not data:
        raise ProviderError("تعذّر الوصول إلى مصدر الذهب")

    spot_usd = data.get("price")
    try:
        spot_usd = float(spot_usd)
    except (TypeError, ValueError):
        raise ProviderError("سعر الأونصة غير صالح في الاستجابة")
    if spot_usd <= 0:
        raise ProviderError("سعر الأونصة غير منطقي")

    gram_24k_egp = (spot_usd / GRAMS_PER_TROY_OUNCE) * rate

    updated = 0
    price_21k = None
    for label, karat, order in KARATS:
        price = round(gram_24k_egp * (karat / 24), 2)
        if karat == 21:
            price_21k = price

        existing = GoldKarat.objects.filter(label=label).first()
        change = pct_change(existing.price if existing else price, price)
        GoldKarat.objects.update_or_create(
            label=label,
            defaults=dict(price=price, change_pct=abs(change), is_up=change >= 0, order=order),
        )
        updated += 1

    if price_21k:
        label = "جنيه ذهب"
        price = round(price_21k * GOLD_POUND_GRAMS, 2)
        existing = GoldKarat.objects.filter(label=label).first()
        change = pct_change(existing.price if existing else price, price)
        GoldKarat.objects.update_or_create(
            label=label,
            defaults=dict(price=price, change_pct=abs(change), is_up=change >= 0, order=4),
        )
        updated += 1

    return updated
