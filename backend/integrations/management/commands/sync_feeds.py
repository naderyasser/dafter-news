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

from integrations.client import ProviderError
from integrations.models import SyncLog
from integrations.providers import PROVIDERS, REGISTRY


class Command(BaseCommand):
    help = "تحديث البيانات من المصادر الخارجية (عملات، ذهب، طقس، مواقيت، مباريات، أخبار)"

    def add_arguments(self, parser):
        parser.add_argument("--only", help="مصادر محددة مفصولة بفاصلة")
        parser.add_argument("--skip", help="مصادر يتم تخطيها، مفصولة بفاصلة")
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

        ok = failed = 0
        for provider in selected:
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
        self.stdout.write(self.style.SUCCESS(summary) if not failed else self.style.WARNING(summary))
