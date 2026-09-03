"""
Cache invalidation for the media desks, wired to the database rather than to
the dashboard.

Mirrors content/signals.py's own reasoning exactly, on the sibling app that
never had it: hanging revalidation off the model means every write path is
covered — the dashboard, the Django admin, a direct API write, anything
written later — rather than only the one UI someone remembered to wire by
hand. Neither `Reel` nor `Video` had any of this. A save or delete only ever
reached the home page once the natural ISR window elapsed on its own —
getReels'/getVideos' own 60s revalidate plus the page's own 30s on top of it,
so up to roughly ninety seconds after an editor published something. That gap
is what the newsroom read as «بالمختصر» "not updating" after adding a second
reel — the dashboard showed it immediately (it fetches with `FRESH`, i.e.
revalidate: 0), the public home page hadn't reached its own window yet.

`video` already depends on `content` for `Section`, so importing its
revalidation helper here adds no new coupling between the two apps.
"""
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from content.revalidate import revalidate_site

from .models import Reel, Video


@receiver([post_save, post_delete], sender=Reel)
@receiver([post_save, post_delete], sender=Video)
def media_changed(sender, **kwargs) -> None:
    revalidate_site()
