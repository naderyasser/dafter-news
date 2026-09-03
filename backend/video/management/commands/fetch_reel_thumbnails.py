"""
Fetch the missing poster for every reel that has none.

For the reels saved before the scraper existed, and as the retry for any reel
whose fetch failed at save time — a private video made public, a Facebook
outage that has since passed. Safe to run repeatedly: it only ever touches rows
with no picture, so a poster an editor uploaded by hand is never overwritten.
"""

from django.core.management.base import BaseCommand
from django.db.models import Q

from video.models import Reel
from video.og import attach_scraped_metadata


class Command(BaseCommand):
    help = "Fetch the Facebook poster for reels that have no thumbnail."

    def add_arguments(self, parser):
        parser.add_argument(
            "--all",
            action="store_true",
            help="Re-fetch every reel, including ones that already have a poster.",
        )

    def handle(self, *args, **options):
        # Both spellings of "no picture": the column is null=True, so an
        # untouched row holds NULL while one cleared through a form holds "".
        missing = Q(thumbnail="") | Q(thumbnail__isnull=True)
        reels = Reel.objects.all() if options["all"] else Reel.objects.filter(missing)
        total = reels.count()
        if not total:
            self.stdout.write("لا توجد ريلز بلا صورة.")
            return

        fetched = 0
        for reel in reels:
            # want_title=False: this command's job is the picture. A row that
            # already exists already has a title one way or another — an
            # editor typed it before this form dropped the field, or a
            # previous scrape or the untitled fallback set it — and rewriting
            # it during an unrelated picture backfill would be a surprise a
            # bulk ops run has no business springing on the newsroom.
            _, image_set = attach_scraped_metadata(reel, want_title=False, want_image=True)
            if image_set:
                fetched += 1
                self.stdout.write(self.style.SUCCESS(f"✓ {reel.title[:50]}"))
            else:
                # og.attach_scraped_metadata has already logged the reason.
                self.stdout.write(self.style.WARNING(f"✗ {reel.title[:50]}"))

        self.stdout.write(f"تم: {fetched} من {total}")
