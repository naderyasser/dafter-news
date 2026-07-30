"""
Arabic news wire ingest.

NewsData.io: 200 credits/day on the free tier, 89 languages, and it permits
production use — unlike NewsAPI.org, whose free plan is explicitly
development-only and bars commercial use, and GNews, whose free tier its own
pricing page marks non-commercial.

Wire copy lands in WireArticle, never in Article. These stories belong to
whoever filed them; they surface as a "من حول العالم" rail with the source
credited and a link out, and in the dashboard as leads for our own reporters.
"""
import os
from datetime import datetime, timezone as dt_timezone

from integrations.client import ProviderError, fetch_json
from integrations.models import WireArticle

SOURCE = "newswire"
LABEL = "وكالات الأنباء — NewsData.io"
ENDPOINT = "https://newsdata.io/api/1/latest"

MAX_STORED = 60

# The floor between two calls to this provider, enforced by sync_feeds no
# matter how often the cron fires.
#
# The quota in the docstring above is 200 credits/day. The cron ran the whole
# feed set once a minute, so this endpoint was called 1,440 times a day: the
# allowance burned out before breakfast and every call for the rest of the day
# came back HTTP 429. It sat that way for 1,051 consecutive attempts — the one
# feed whose job is to fill the desks that had the least on them.
#
# Fixing the crontab alone would have left the same trap armed for whoever
# edits it next, which is why the limit lives beside the quota it protects.
# 900s = 96 calls/day, comfortably inside 200 with room for a manual re-run.
MIN_INTERVAL_SECONDS = 900


def _parse_dt(value):
    """NewsData sends 'YYYY-MM-DD HH:MM:SS' in UTC."""
    if not value:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=dt_timezone.utc)
        except (ValueError, TypeError):
            continue
    return None


def sync():
    """Pull the latest Arabic stories. Returns the number stored."""
    api_key = os.environ.get("NEWSDATA_API_KEY")
    if not api_key:
        raise ProviderError("NEWSDATA_API_KEY غير مضبوط")

    data = fetch_json(
        ENDPOINT,
        params={"apikey": api_key, "language": "ar", "country": "eg,sa,ae", "size": 10},
    )
    if not data:
        raise ProviderError("تعذّر الوصول إلى مصدر الأخبار")
    if data.get("status") != "success":
        raise ProviderError(str(data.get("results", {}) or data.get("message", "استجابة غير متوقعة"))[:200])

    results = data.get("results") or []
    stored = 0
    for item in results:
        external_id = item.get("article_id") or item.get("link")
        title = (item.get("title") or "").strip()
        link = item.get("link") or ""
        # A wire item with no title or no link is unusable downstream — it
        # would render as an empty card that goes nowhere.
        if not external_id or not title or not link:
            continue

        WireArticle.objects.update_or_create(
            external_id=str(external_id)[:200],
            defaults=dict(
                title=title[:400],
                summary=(item.get("description") or "")[:2000],
                url=link[:600],
                image_url=(item.get("image_url") or "")[:600],
                source_name=(item.get("source_name") or item.get("source_id") or "")[:120],
                provider="newsdata",
                language=(item.get("language") or "ar")[:8],
                published_at=_parse_dt(item.get("pubDate")),
            ),
        )
        stored += 1

    # Trim the tail so the table doesn't grow without bound on a feed that
    # runs every few minutes forever.
    keep_ids = WireArticle.objects.order_by("-published_at", "-fetched_at").values_list("id", flat=True)[:MAX_STORED]
    WireArticle.objects.exclude(id__in=list(keep_ids)).delete()

    if not stored:
        raise ProviderError("لم تصل أي أخبار صالحة")
    return stored
