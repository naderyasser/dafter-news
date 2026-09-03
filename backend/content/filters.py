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

    #: «الأكثر تعليقاً» asks for the stories readers are discussing. Ranked by
    #: `-comment_count` alone that is not what it returns: almost every story
    #: carries zero comments, they all tie at the top of the sort, and
    #: StableOrderingFilter breaks the tie on `-published_at` — so the tab
    #: renders the newest stories, an exact copy of the «الأحدث» tab beside
    #: it. The newsroom read that as the two tabs being wired to each other's
    #: query; they are not, and this is the actual cause.
    #:
    #: `has_comments=true` drops the ties out of the pool entirely, so the tab
    #: either ranks stories that really are being discussed or returns
    #: nothing — and nothing is an answer the UI can state honestly, where a
    #: duplicate of the other tab is not.
    has_comments = filters.BooleanFilter(
        method="filter_has_comments",
        label="له تعليقات",
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

    def filter_has_comments(self, queryset, name, value):
        """
        Reads the `comment_count` annotation ArticleViewSet.queryset already
        applies, so this costs no extra aggregate.

        `has_comments=false` is the deliberate complement (stories with no
        discussion yet), not a no-op — a filter that silently ignored one of
        its two values would be a trap for the next caller.
        """
        if value is None:
            return queryset
        return queryset.filter(comment_count__gt=0) if value else queryset.filter(comment_count=0)
