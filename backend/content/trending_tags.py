"""
«وسوم رائجة» — which tags are actually moving.

The home page used to show the first five tags in ALPHABETICAL order
(`Tag.Meta.ordering = ["name"]`), which is why the newsroom saw the same
five hashtags for weeks: nothing about that list ever depended on what was
being published.

A trending tag is one that recent stories keep carrying. The ranking here
counts each tag's published stories inside a window and lets this week's
stories count extra, so a tag that has just started appearing climbs past
one that was busy three weeks ago and has gone quiet. Ties break on the
most recent use, then the name — so the order still moves on a slow day.

Why two windows and not one: on this site a single week rarely carries
more than one story per tag (measured on production: every 7-day count
was 1), so a week-only ranking is a tie broken alphabetically — the exact
staleness being fixed. A month of stories has real shape (48, 37, 24…),
and the week's weight is what keeps it current inside that shape.
"""

from datetime import timedelta

from django.db.models import Count, ExpressionWrapper, F, IntegerField, Max, Q
from django.utils import timezone

from .models import Article, Tag

#: How far back a story still counts toward a tag's rank.
WINDOW_DAYS = 30
#: Stories inside this many days count VELOCITY_WEIGHT times.
VELOCITY_DAYS = 7
VELOCITY_WEIGHT = 2

#: What earns the flame in the UI: used at least this often this week, OR
#: this often across the month. Either is a tag readers keep meeting.
HOT_WEEK_COUNT = 2
HOT_WINDOW_COUNT = 20

DEFAULT_LIMIT = 12
MAX_LIMIT = 50


def trending_tags(limit: int = DEFAULT_LIMIT, now=None):
    """
    Tags ranked by recent published use, best first. Each row carries
    `recent_count` (stories inside WINDOW_DAYS), `week_count` (inside
    VELOCITY_DAYS), `last_used` and a computed `is_hot`.

    Tags with no published story in the window are left out entirely: a
    trending list padded with idle tags is the old alphabetical list again.
    """
    now = now or timezone.now()
    published = Q(articles__status=Article.Status.PUBLISHED)
    in_window = published & Q(articles__published_at__gte=now - timedelta(days=WINDOW_DAYS))
    in_week = published & Q(articles__published_at__gte=now - timedelta(days=VELOCITY_DAYS))

    qs = (
        Tag.objects.annotate(
            recent_count=Count("articles", filter=in_window, distinct=True),
            week_count=Count("articles", filter=in_week, distinct=True),
            last_used=Max("articles__published_at", filter=published),
        )
        .annotate(
            score=ExpressionWrapper(
                F("week_count") * VELOCITY_WEIGHT + F("recent_count"), output_field=IntegerField()
            )
        )
        .filter(recent_count__gt=0)
        .order_by("-score", "-last_used", "name")
    )
    tags = list(qs[: max(1, min(int(limit), MAX_LIMIT))])
    for tag in tags:
        tag.is_hot = tag.week_count >= HOT_WEEK_COUNT or tag.recent_count >= HOT_WINDOW_COUNT
    return tags
