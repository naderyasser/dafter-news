"""
Cache invalidation, wired to the database rather than to one UI.

Every path that can put a story in front of a reader ends in an Article
save: the dashboard editor, the scheduled publisher on cron, the Django
admin, a direct API write. Hanging the revalidation off the model means all
of them are covered, including the ones nobody has written yet — which is
the whole reason the previous approach (a call in the editor's save handler)
missed the cron publisher and the admin.
"""
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Article, BreakingNewsItem, Section, Story
from .revalidate import revalidate_site


@receiver(post_save, sender=Article)
def article_saved(sender, instance: Article, created: bool, **kwargs) -> None:
    """
    Revalidate when a story is, was, or stops being visible to readers.

    Draft-to-draft edits are skipped: an editor typing into an unpublished
    story would otherwise flush the whole site's cache on every autosave, and
    nothing a reader can see has changed.

    `scheduled` counts as a state worth flushing because the publisher flips
    it to `published` and we want the transition either side to land.
    """
    if instance.status in {"published", "scheduled"}:
        revalidate_site()
        return

    # Unpublishing has to flush too, or a withdrawn story keeps being served
    # from cache — the one case where a stale page is a correctness problem
    # rather than a freshness one.
    if not created:
        revalidate_site()


@receiver(post_delete, sender=Article)
def article_deleted(sender, instance: Article, **kwargs) -> None:
    revalidate_site()


# The site chrome: a renamed section or a new ticker item shows on every page,
# so these flush the tree as well. Low-frequency by nature — the newsroom
# edits them rarely — so there is no autosave problem to guard against.
@receiver([post_save, post_delete], sender=Section)
@receiver([post_save, post_delete], sender=BreakingNewsItem)
@receiver([post_save, post_delete], sender=Story)
def chrome_changed(sender, **kwargs) -> None:
    revalidate_site()
