"""
Foreign-exchange rates against the Egyptian pound.

Source is exchangerate.host, which is keyless and permits commercial use.
It publishes a single mid-market rate; Egyptian banks quote a buy and a sell
around it, which is what the design shows. We derive the pair by applying a
spread rather than inventing two independent numbers, so buy < sell always
holds and the mid stays exactly what the source reported.

If you later sign up for a bank-rates feed (EgyptRates publishes real
per-bank buy/sell for Egypt), swap `_derive_spread` for the real quotes —
nothing else in the pipeline needs to change.
"""
import os

from integrations.client import ProviderError, fetch_json, pct_change, push_series
from market.models import Currency

SOURCE = "currency"
LABEL = "العملات — exchangerate.host"
ENDPOINT = "https://api.exchangerate.host/latest"

# Half-spread applied either side of the mid rate. 0.35% sits in the range
# Egyptian banks actually quote on majors; it is a presentation detail, not
# a claim about any specific bank.
HALF_SPREAD = 0.0035

TRACKED = [
    ("USD", "🇺🇸", 1),
    ("EUR", "🇪🇺", 2),
    ("GBP", "🇬🇧", 3),
    ("SAR", "🇸🇦", 4),
    ("AED", "🇦🇪", 5),
    ("KWD", "🇰🇼", 6),
]


def _derive_spread(mid):
    buy = round(mid * (1 - HALF_SPREAD), 2)
    sell = round(mid * (1 + HALF_SPREAD), 2)
    return buy, sell


def sync():
    """Refresh tracked pairs against EGP. Returns rows updated."""
    base = os.environ.get("FX_BASE", "EGP")
    symbols = ",".join(code for code, _, _ in TRACKED)
    data = fetch_json(ENDPOINT, params={"base": base, "symbols": symbols})

    if not data or not isinstance(data.get("rates"), dict):
        raise ProviderError("استجابة غير صالحة من مصدر العملات")

    rates = data["rates"]
    updated = 0
    for code, flag, order in TRACKED:
        rate = rates.get(code)
        # The API quotes EGP→USD (a small number); the ticker shows the
        # price of one unit of foreign currency in pounds, so invert.
        try:
            rate = float(rate)
        except (TypeError, ValueError):
            continue
        if rate <= 0:
            continue
        mid = 1 / rate

        existing = Currency.objects.filter(code=code).first()
        previous_mid = float(existing.sell) if existing else mid
        buy, sell = _derive_spread(mid)
        change = pct_change(previous_mid, sell)

        Currency.objects.update_or_create(
            code=code,
            defaults=dict(
                flag_emoji=flag,
                buy=buy,
                sell=sell,
                change_pct=abs(change),
                is_up=change >= 0,
                series=push_series(existing.series if existing else [], sell),
                order=order,
            ),
        )
        updated += 1

    if not updated:
        raise ProviderError("لم يصل أي سعر صرف صالح")
    return updated
