"""
Refresh external feeds. Safe to run on a tight cron.

    python manage.py sync_feeds                 # every source
    python manage.py sync_feeds --only currency,gold
    python manage.py sync_feeds --skip newswire

Each source is isolated: one provider raising, timing out, or being
unconfigured never stops the others, and never blanks the data already on
screen. The outcome per source lands in SyncLog, which is what the dashboard
reads to show whether the ticker is current or coasting on stale numbers.
"""
import traceback

from django.core.management.base import BaseCommand
from django.utils import timezone

from integrations.client import ProviderError
from integrations.models import SyncLog
from integrations.providers import PROVIDERS, REGISTRY


class Command(BaseCommand):
    help = "تحديث البيانات من المصادر الخارجية (عملات، ذهب، طقس، مواقيت، مباريات، أخبار)"

    def add_arguments(self, parser):
        parser.add_argument("--only", help="مصادر محددة مفصولة بفاصلة")
        parser.add_argument("--skip", help="مصادر يتم تخطيها، مفصولة بفاصلة")
        parser.add_argument(
            "--force",
            action="store_true",
            help="تجاهل الحد الأدنى للفاصل الزمني بين النداءات (تشغيل يدوي)",
        )
        parser.add_argument(
            "--fail-fast",
            action="store_true",
            help="أوقف عند أول خطأ (للتشخيص فقط — الافتراضي أن كل مصدر معزول)",
        )

    def handle(self, *args, **options):
        selected = PROVIDERS
        if options.get("only"):
            keys = [k.strip() for k in options["only"].split(",") if k.strip()]
            unknown = [k for k in keys if k not in REGISTRY]
            if unknown:
                self.stderr.write(self.style.ERROR(f"مصادر غير معروفة: {', '.join(unknown)}"))
                self.stderr.write(f"المتاح: {', '.join(REGISTRY)}")
                return
            selected = [REGISTRY[k] for k in keys]
        if options.get("skip"):
            skip = {k.strip() for k in options["skip"].split(",")}
            selected = [p for p in selected if p.SOURCE not in skip]

        ok = failed = skipped = 0
        force = bool(options.get("force"))
        for provider in selected:
            # A provider may declare a minimum gap between calls when the
            # service it wraps meters requests. Honouring it here rather than
            # in each provider keeps the rule next to the scheduler that would
            # otherwise breach it.
            #
            # NOT bypassed by --only: the cron line for the metered feed is
            # itself an --only run, so treating that as "manual" would have
            # disabled the guard precisely where it has to hold. --force is
            # the explicit escape hatch for a human at a terminal.
            wait = self._throttled_for(provider) if not force else 0
            if wait:
                skipped += 1
                self.stdout.write(f"… {provider.SOURCE}: تخطٍّ ({wait}s حتى التحديث التالي)")
                continue
            try:
                records = provider.sync()
            except ProviderError as exc:
                failed += 1
                SyncLog.record_failure(provider.SOURCE, provider.LABEL, str(exc))
                self.stderr.write(self.style.WARNING(f"✗ {provider.SOURCE}: {exc}"))
                if options.get("fail_fast"):
                    raise
            except Exception as exc:  # noqa: BLE001 — a cron must survive anything
                failed += 1
                SyncLog.record_failure(provider.SOURCE, provider.LABEL, f"{type(exc).__name__}: {exc}")
                self.stderr.write(self.style.ERROR(f"✗ {provider.SOURCE}: {type(exc).__name__}: {exc}"))
                if options.get("fail_fast"):
                    self.stderr.write(traceback.format_exc())
                    raise
            else:
                ok += 1
                SyncLog.record_success(provider.SOURCE, provider.LABEL, records=records)
                self.stdout.write(self.style.SUCCESS(f"✓ {provider.SOURCE}: {records} سجل"))

        summary = f"تم: {ok} نجح، {failed} فشل"
        if skipped:
            summary += f"، {skipped} تخطٍّ"
        self.stdout.write(self.style.SUCCESS(summary) if not failed else self.style.WARNING(summary))

    @staticmethod
    def _throttled_for(provider):
        """
        Seconds still to wait before this provider may be called again, or 0.

        Reads the last attempt off SyncLog rather than keeping its own clock,
        so the floor survives a restart and cannot be reset by running the
        command twice.
        """
        floor = getattr(provider, "MIN_INTERVAL_SECONDS", 0)
        if not floor:
            return 0
        row = SyncLog.objects.filter(source=provider.SOURCE).only("last_attempt_at").first()
        if not row or not row.last_attempt_at:
            return 0
        elapsed = (timezone.now() - row.last_attempt_at).total_seconds()
        return max(0, int(floor - elapsed))
