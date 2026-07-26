from django.http import Http404


class SlugOrPkLookupMixin:
    """
    Resolve a detail route by either the public slug or the numeric pk.

    Public pages link by slug (/article/محور-الدلتا), while the dashboard
    holds records by id and PATCHes /articles/12/ — without this, one of
    the two silently 404s. Keep `lookup_field = "slug"` on the viewset so
    slugs stay the canonical public URL.
    """

    def get_object(self):
        lookup = self.kwargs[self.lookup_url_kwarg or self.lookup_field]
        qs = self.filter_queryset(self.get_queryset())
        obj = qs.filter(pk=lookup).first() if str(lookup).isdigit() else qs.filter(**{self.lookup_field: lookup}).first()
        if obj is None:
            raise Http404
        self.check_object_permissions(self.request, obj)
        return obj
