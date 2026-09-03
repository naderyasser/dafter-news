"""
Re-resolve every reel's Facebook link to its embeddable, canonical form.

For the reels saved before video/og.py started canonicalizing on every scrape
— chiefly the ones whose link is a `/share/r/<id>/` short URL, the shape
staff's own "Share" button hands out. That shape plays fine on facebook.com
itself but makes the embed plugin answer with its own "Video Unavailable"
error; the reel's resolved `/reel/<id>/` permalink does not. Safe to run
repeatedly — a reel whose link is already canonical is simply left alone.
"""

from django.core.management.base import BaseCommand

from video.models import Reel
from video.og import attach_scraped_metadata


class Command(BaseCommand):
    help = "Resolve every reel's facebook_url to its canonical, embeddable form."

    def handle(self, *args, **options):
        reels = Reel.objects.exclude(facebook_url="")
        total = reels.count()
        if not total:
            self.stdout.write("لا توجد ريلز لديها رابط فيسبوك.")
            return

        normalized = 0
        for reel in reels:
            before = reel.facebook_url
            # Title and picture are left exactly as they are — this pass is
            # about the link alone, same reasoning as fetch_reel_thumbnails'
            # own want_title=False: rewriting either as a side effect of an
            # unrelated bulk pass would be a surprise the newsroom never
            # asked for.
            attach_scraped_metadata(reel, want_title=False, want_image=False, want_url_normalize=True)
            if reel.facebook_url != before:
                normalized += 1
                self.stdout.write(self.style.SUCCESS(f"✓ {before} → {reel.facebook_url}"))

        self.stdout.write(f"تم تصحيح {normalized} من أصل {total}")
