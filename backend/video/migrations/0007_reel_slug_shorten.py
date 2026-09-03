# Recalculates every EXISTING reel's slug against the new short-slug rule
# (video/models.py's short_slug_base — six words or fifty characters,
# whichever comes first) rather than the old one, which kept effectively the
# whole scraped headline. The newsroom's own report: those full-headline
# slugs turned into a wall of percent-encoded Arabic the instant a reel's
# link was copied anywhere, e.g. into a WhatsApp share sheet.
#
# A migration, not a one-off management command, on purpose — it needs to run
# exactly once as part of THIS deploy, automatically, the same way
# 0006_reel_slug's own backfill did; nothing about "shorten every existing
# slug to the new rule" is a repeatable operations task worth a standing
# command the newsroom would ever run again by hand.

from django.db import migrations

from video.models import short_slug_base


def shorten_existing_slugs(apps, schema_editor):
    Reel = apps.get_model("video", "Reel")
    # short_slug_base is a plain str -> str function with no dependency on
    # the model's own schema, so it is safe to import directly here rather
    # than re-inlining a second copy of the same logic (unlike 0006's own
    # backfill, which predates this function existing at all).
    for reel in Reel.objects.all().order_by("pk"):
        base = short_slug_base(reel.title)
        slug = base
        n = 2
        while Reel.objects.filter(slug=slug).exclude(pk=reel.pk).exists():
            slug = f"{base}-{n}"
            n += 1
        if slug != reel.slug:
            reel.slug = slug
            reel.save(update_fields=["slug"])


def noop_reverse(apps, schema_editor):
    # Nothing to undo — the old, longer slugs are not recoverable from the
    # new ones, and nothing about the schema itself changed in this
    # migration for a rollback to need to touch.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("video", "0006_reel_slug"),
    ]

    operations = [
        migrations.RunPython(shorten_existing_slugs, noop_reverse),
    ]
