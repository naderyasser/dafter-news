from datetime import timedelta

import django_filters as filters
from django.utils import timezone

from .models import Article


class ArticleFilterSet(filters.FilterSet):
    """
    The article list's filters — everything `filterset_fields` used to
    declare, plus a recency window.

    `published_within` is what makes «الأكثر قراءة» mean anything. Ranked by
    views alone and unbounded, that list is an all-time leaderboard: the
    stories with the longest time to accumulate reads sit at the top and stay
    there, and a piece published this morning cannot displace one from three
    weeks ago no matter how well it does today. Every newsroom scopes the
    list to a period for this reason — «الأكثر قراءة» is a claim about what
    is being read *now*, not about which story has been in front of the most
    eyes since launch.

    Deliberately a whole number of DAYS rather than a timestamp: the value
    goes into the URL the frontend fetches, and a moving `published_after=…`
    timestamp would mint a fresh cache key on every render, so the ISR entry
    for that request could never be reused.
    """

    published_within = filters.NumberFilter(
        method="filter_published_within",
        label="نُشر خلال آخر N يوم",
    )

    class Meta:
        model = Article
        fields = [
            "status", "kind", "language", "section__key", "badge",
            "tags__slug", "pinned", "author__username",
        ]

    def filter_published_within(self, queryset, name, value):
        # `value` is already a number here: NumberFilter coerces it and
        # answers a non-numeric one with a 400 before this runs, and an
        # absent/blank parameter never calls the method at all.
        days = int(value)
        if days <= 0:
            # 0 / negative reads as "no window" rather than "no articles":
            # a caller that means to drop the window shouldn't have to
            # remove the parameter, and an empty list is a worse answer to
            # a meaningless window than the unfiltered one.
            return queryset
        return queryset.filter(published_at__gte=timezone.now() - timedelta(days=days))
