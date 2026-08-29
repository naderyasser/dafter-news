"""
Fire everything whose scheduled moment has arrived.

The dashboard has promised scheduling for a while — Article.scheduled_for and
AdPlacement.scheduled_start/end are on the models and in the serializers, so
an editor could fill them in and save — but nothing ever acted on them. A
story scheduled for 9:00 stayed a مسودة forever; a campaign that was supposed
to stop on the 30th kept running. This command is the missing actor. Cron
runs it every minute alongside sync_feeds.

Semantics, deliberately boring:

* Articles: status=SCHEDULED with scheduled_for in the past flips to
  PUBLISHED. published_at is stamped only if empty — a story that was
  published once before keeps its original date on the page. scheduled_for
  is left in place as the record of when it was meant to go out.

* Ads: the schedule columns are one-shot pending actions, consumed on fire.
  A start that arrives turns the placement on and *clears* scheduled_start;
  an end that arrives turns it off and clears both. Consuming them is what
  keeps this idempotent alongside the editor's own on/off switch — without
  it, an editor who manually pauses a placement mid-window would find the
  cron flipping it back on sixty seconds later, and a switch that fights
  the person operating it teaches them the dashboard can't be trusted.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from ads.models import AdPlacement
from content.models import Article
from content.tts import TtsError, generate_for_article


class Command(BaseCommand):
    help = "ينشر المقالات المجدولة التي حان وقتها ويشغّل/يوقف الإعلانات حسب نافذتها"

    def handle(self, *args, **options):
        now = timezone.now()

        due = Article.objects.filter(status=Article.Status.SCHEDULED, scheduled_for__lte=now)
        published = 0
        for article in due:
            article.status = Article.Status.PUBLISHED
            if not article.published_at:
                article.published_at = now
            article.save(update_fields=["status", "published_at", "updated_at"])
            published += 1
            self.stdout.write(f"✓ نُشر: {article.title[:60]}")
            # Same «استمع للمقال» narration the dashboard's own publish button
            # now triggers (see ArticleEditorForm.save) — a scheduled story
            # going out on its own here must not be the one publish path that
            # leaves the player silent. Best-effort: one article's narration
            # failing (a bad wire to the voice engine) must not stop the rest
            # of this run, so it's caught and logged rather than raised.
            try:
                generate_for_article(article)
            except TtsError as exc:
                self.stderr.write(f"  تعذّر توليد الصوت لـ«{article.title[:44]}»: {exc}")

        started = AdPlacement.objects.filter(
            active=False, scheduled_start__isnull=False, scheduled_start__lte=now
        ).exclude(scheduled_end__lte=now)
        ads_on = 0
        for ad in started:
            ad.active = True
            ad.scheduled_start = None
            ad.save(update_fields=["active", "scheduled_start"])
            ads_on += 1
            self.stdout.write(f"✓ إعلان بدأ: {ad.name}")

        ended = AdPlacement.objects.filter(active=True, scheduled_end__isnull=False, scheduled_end__lte=now)
        ads_off = 0
        for ad in ended:
            ad.active = False
            ad.scheduled_end = None
            ad.scheduled_start = None
            ad.save(update_fields=["active", "scheduled_start", "scheduled_end"])
            ads_off += 1
            self.stdout.write(f"✓ إعلان انتهى: {ad.name}")

        # An expired start whose window has fully passed (start AND end both
        # behind us, placement already off) is dead weight that would fire
        # the moment someone re-enabled... it can't: the activation filter
        # excludes passed ends. But the stale pair still reads as "pending"
        # in the dashboard, so sweep it.
        AdPlacement.objects.filter(
            active=False, scheduled_start__isnull=False, scheduled_end__isnull=False, scheduled_end__lte=now
        ).update(scheduled_start=None, scheduled_end=None)

        if published or ads_on or ads_off:
            self.stdout.write(self.style.SUCCESS(f"تم: {published} مقال، إعلانات +{ads_on}/-{ads_off}"))
        else:
            self.stdout.write("لا شيء مستحق")
