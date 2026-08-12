"use client";

import { useState } from "react";

import { dashMutate } from "@/lib/api";
import type { SyncLog } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  ok: "bg-up-tint text-up",
  failed: "bg-down-tint text-down",
  skipped: "bg-surface-2 text-ink-2",
};
const STATUS_LABELS: Record<string, string> = { ok: "يعمل", failed: "متوقف", skipped: "لم يُشغّل" };

function ago(iso: string | null) {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  return `منذ ${Math.floor(hrs / 24)} يوم`;
}

/**
 * Feed health for the newsroom.
 *
 * The column that matters is «آخر تحديث ناجح», not the status pill: a failed
 * source keeps serving its last good numbers, so the real question isn't
 * "did the last run fail" but "how old is what readers are seeing". A source
 * that's been failing quietly for a day looks identical on the site to one
 * that's fine — this table is the only place that difference shows.
 */
export default function FeedsPanel({ logs: initial }: { logs: SyncLog[] }) {
  const [logs, setLogs] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = async (source?: string) => {
    setBusy(source ?? "all");
    setError("");
    try {
      // Goes through dashMutate (not a bare fetch) so the session cookie and
      // the X-CSRFToken header SessionAuthentication requires on unsafe
      // methods are both attached — a bare fetch here always came back 403.
      const updated = await dashMutate<SyncLog[]>("/sync-now/", "POST", source ? { source } : {});
      setLogs(updated);
    } catch {
      setError("تعذّر تشغيل التحديث — راجع سجلّ الخادم");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[560px] text-[14px] leading-relaxed text-ink-2">
          المصادر الخارجية تُحدَّث تلقائياً. عند تعذّر الوصول لمصدر تبقى آخر بيانات ناجحة ظاهرة على
          الموقع — لذلك المهم هنا هو <strong className="font-bold text-ink">عمر البيانات</strong> وليس
          حالة آخر محاولة.
        </p>
        <button
          type="button"
          onClick={() => refresh()}
          disabled={busy !== null}
          className="flex-shrink-0 rounded-pill bg-brand px-5 py-2.5 text-[14px] font-bold text-paper transition-colors duration-fast hover:bg-brand-strong disabled:opacity-50"
        >
          {busy === "all" ? "جارٍ التحديث..." : "تحديث الكل"}
        </button>
      </div>

      {error ? (
        <div className="rounded border border-down/30 bg-down-tint px-4 py-2.5 text-[14px] font-semibold text-down">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-card border border-line bg-paper">
        <div className="grid grid-cols-[1.6fr_.8fr_1fr_.7fr_.8fr] bg-surface">
          {["المصدر", "الحالة", "آخر تحديث ناجح", "سجلات", ""].map((h, i) => (
            <div key={i} className="px-4 py-2.5 text-start text-[13px] font-bold text-ink-3">
              {h}
            </div>
          ))}
        </div>

        {logs.length === 0 ? (
          <div className="px-4 py-8 text-center text-[14px] text-ink-3">لم تُشغّل أي مزامنة بعد</div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="grid grid-cols-[1.6fr_.8fr_1fr_.7fr_.8fr] items-center border-t border-line hover:bg-surface"
            >
              <div className="px-4 py-3">
                <div className="text-[14.5px] font-bold text-ink">{log.label || log.source}</div>
                {log.message ? (
                  <div className="mt-0.5 truncate text-[12.5px] text-ink-3" title={log.message}>
                    {log.message}
                  </div>
                ) : null}
              </div>

              <div className="px-4 py-3">
                <span
                  className={`inline-flex rounded-pill px-2.5 py-1 text-[12.5px] font-bold ${STATUS_STYLES[log.status] ?? STATUS_STYLES.skipped}`}
                >
                  {STATUS_LABELS[log.status] ?? log.status}
                </span>
              </div>

              <div className="px-4 py-3">
                {/* suppressHydrationWarning: this label is "now minus a
                    timestamp". The server computes it when it renders and the
                    browser recomputes it when it hydrates, so crossing a minute
                    boundary between the two makes them legitimately disagree
                    ("منذ ٧ دقيقة" vs "منذ ٨") and React logged a mismatch on
                    every load of this screen. The browser's value is the
                    correct one and is what stays on screen. */}
                <time
                  dateTime={log.last_success_at ?? undefined}
                  suppressHydrationWarning
                  className={`text-[13.5px] font-semibold ${log.is_stale ? "text-down" : "text-ink-2"}`}
                >
                  {ago(log.last_success_at)}
                </time>
                {log.is_stale ? <span className="ms-1.5 text-[12px] font-bold text-down">قديمة</span> : null}
              </div>

              <div className="tnum px-4 py-3 text-[14px] text-ink-2">{log.records}</div>

              <div className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => refresh(log.source)}
                  disabled={busy !== null}
                  className="text-[13.5px] font-bold text-brand transition-colors duration-fast hover:text-brand-strong disabled:opacity-50"
                >
                  {busy === log.source ? "..." : "تحديث"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
