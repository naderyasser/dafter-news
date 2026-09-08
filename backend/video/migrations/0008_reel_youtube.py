# «حصل إيه؟» moves from Facebook reels to YouTube: the link column is renamed
# to the platform-neutral `url`, and `youtube_id` is added and back-filled by
# parsing every existing link with the same function Reel.save() uses.
#
# Rows whose link is not a YouTube video (the Facebook reels saved before this)
# are deliberately NOT deleted: they keep an empty youtube_id, which the public
# API filters out and the dashboard flags so the newsroom can delete them
# itself. A migration that silently drops editorial rows is the wrong place
# for that decision.

from django.db import migrations, models

from video.youtube import extract_video_id


def backfill_youtube_ids(apps, schema_editor):
    Reel = apps.get_model("video", "Reel")
    for reel in Reel.objects.all().only("pk", "url"):
        video_id = extract_video_id(reel.url) or ""
        if video_id:
            Reel.objects.filter(pk=reel.pk).update(youtube_id=video_id)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("video", "0007_reel_slug_shorten"),
    ]

    operations = [
        migrations.RenameField(
            model_name="reel",
            old_name="facebook_url",
            new_name="url",
        ),
        migrations.AlterField(
            model_name="reel",
            name="url",
            field=models.URLField(
                help_text="رابط الفيديو على يوتيوب (Short أو فيديو عادي) — العنوان والصورة يُجلبان منه تلقائياً",
                max_length=500,
            ),
        ),
        migrations.AddField(
            model_name="reel",
            name="youtube_id",
            field=models.CharField(blank=True, db_index=True, default="", editable=False, max_length=16),
        ),
        migrations.RunPython(backfill_youtube_ids, noop_reverse),
    ]
