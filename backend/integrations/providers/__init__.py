"""
Registry of external feeds.

Each provider module exposes SOURCE, LABEL and a `sync()` that returns the
number of records it refreshed, or raises ProviderError with an
Arabic-readable reason. Everything else — logging, failure isolation, the
dashboard's status view — is driven off this list.
"""
from integrations.providers import currency, football, gold, newswire, prayer, weather

# Order matters: gold reads USD/EGP out of the currency table, so currency
# has to have run first for a cold database to produce sane gold prices.
PROVIDERS = [currency, gold, weather, prayer, football, newswire]

REGISTRY = {p.SOURCE: p for p in PROVIDERS}

__all__ = ["PROVIDERS", "REGISTRY", "currency", "gold", "weather", "prayer", "football", "newswire"]
