"""
Narrate articles for the «استمع للمقال» player — bulk/backfill entry point.

The player, the model fields and the serializer were all already in place —
only the audio was missing, so every article rendered a transport with a
placeholder duration and nothing to play. Per-article generation is also
available straight from the dashboard editor (ArticleViewSet.generate_tts);
this command is for backfilling everything that predates that button, or a
full re-narration with --all.
"""

from django.core.management.base import BaseCommand

from content.models import Article
from content.tts import TtsError, generate_for_article


class Command(BaseCommand):
    help = "Generate «استمع للمقال» narration for articles that have none."

    def add_arguments(self, parser):
        parser.add_argument("--all", action="store_true", help="Regenerate even where audio already exists.")
        parser.add_argument("--limit", type=int, default=0, help="Stop after N articles.")
        parser.add_argument("--slug", help="Only this article.")

    def handle(self, *args, **opts):
        qs = Article.objects.all().order_by("id")
        if opts.get("slug"):
            qs = qs.filter(slug=opts["slug"])
        elif not opts["all"]:
            qs = qs.filter(tts_audio="")
        if opts["limit"]:
            qs = qs[: opts["limit"]]

        total = qs.count()
        self.stdout.write(f"narrating {total} article(s)")
        done = failed = skipped = 0

        for article in qs:
            try:
                seconds = generate_for_article(article)
                done += 1
                mins, secs = divmod(seconds, 60)
                self.stdout.write(f"  ok    {article.slug[:44]:46s} {mins}:{secs:02d}")
            except TtsError as exc:
                if "لا يوجد نص" in str(exc):
                    skipped += 1
                    self.stdout.write(f"  skip  {article.slug[:44]} (no body to read)")
                else:
                    failed += 1
                    self.stderr.write(f"  FAIL  {article.slug[:44]}: {exc}")

        self.stdout.write(self.style.SUCCESS(f"done={done} failed={failed} skipped={skipped}"))
