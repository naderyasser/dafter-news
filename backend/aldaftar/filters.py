from rest_framework.filters import OrderingFilter


class StableOrderingFilter(OrderingFilter):
    """
    OrderingFilter that always ends with a unique tie-breaker.

    `?ordering=-views` alone hands the database a sort key that most rows
    share — every article on this site starts at 0 views, and thousands stay
    there. Postgres is free to return tied rows in any order it likes, and a
    different order per query is exactly what breaks pagination: page 2 can
    repeat a row from page 1 or skip one entirely, and a list re-rendered a
    minute later can shuffle for no reason a reader can see.

    Appending `-published_at, -pk` fixes both. `-pk` is the part that makes
    the sort total (it is unique, so no ties remain); `-published_at` sits in
    front of it so that when the visible key ties, the newer story wins —
    which is the answer a reader expects from «الأكثر قراءة» when two pieces
    have been read the same number of times.
    """

    tie_breakers = ["-published_at", "-pk"]

    def get_ordering(self, request, queryset, view):
        ordering = super().get_ordering(request, queryset, view)
        if not ordering:
            # No ?ordering= at all: the queryset's own Meta.ordering applies,
            # and those already end in a unique field where it matters.
            return ordering
        fields = [f.lstrip("-") for f in ordering]
        if "pk" in fields or "id" in fields:
            return ordering
        return list(ordering) + [t for t in self.tie_breakers if t.lstrip("-") not in fields]
