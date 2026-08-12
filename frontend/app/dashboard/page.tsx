import Link from "next/link";

import DashboardShell from "@/components/dashboard/DashboardShell";
import StatCard from "@/components/dashboard/StatCard";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { getDashboardOverview } from "@/lib/api";

export const revalidate = 0;

export default async function DashOverviewPage() {
  const data = await getDashboardOverview();
  const stats = data?.stats;
  const chart = data?.chart ?? [];
  const maxBar = Math.max(...chart.map((c) => c.bar_pct), 1);

  const alerts = data?.feed_alerts ?? [];

  return (
    <DashboardShell active="overview" breadcrumb="لوحة التحكم" title="نظرة عامة">
      {/* A dead feed announces itself on the screen every session opens on —
          newswire sat broken for 4,000+ runs with the record buried in a
          table nobody watches. */}
      {alerts.length > 0 && (
        <div role="alert" className="rounded-card border border-gold bg-[#FDF6E3] px-4.5 py-3.5">
          <div className="mb-1 text-[14.5px] font-extrabold text-gold">⚠ تغذيات متوقفة تحتاج انتباهك</div>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[14px] text-ink-2">
            {alerts.map((a) => (
              <li key={a.source}>
                <span className="font-bold">{a.label}</span> — فشل {a.consecutive_failures.toLocaleString("en-US")} محاولة متتالية
                {a.message ? <span className="text-ink-3"> ({a.message})</span> : null}
              </li>
            ))}
          </ul>
          <Link href="/dashboard/feeds" className="mt-1.5 inline-block text-[13.5px] font-bold text-accent no-underline hover:underline">
            راجع شاشة التغذيات ←
          </Link>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {/* change_pct is computed from real counts now, so a down day must
            read as one — a red ▼, not a green ▲ with a minus sign inside. */}
        <StatCard
          label="زيارات اليوم"
          value={(stats?.visits_today ?? 0).toLocaleString("en-US")}
          changeLabel={`${(stats?.visits_change_pct ?? 0) < 0 ? "▼" : "▲"} ${Math.abs(stats?.visits_change_pct ?? 0)}%`}
          up={(stats?.visits_change_pct ?? 0) >= 0}
        />
        <StatCard label="مقالات منشورة" value={(stats?.published_articles ?? 0).toLocaleString("en-US")} changeLabel="▲ —" up />
        <StatCard label="تعليقات معلقة" value={(stats?.pending_comments ?? 0).toLocaleString("en-US")} changeLabel="▼ —" up={false} />
        <StatCard label="مشاهدات فيديو" value={(stats?.video_views ?? 0).toLocaleString("en-US")} changeLabel="▲ —" up />
      </div>

      <div className="rounded-card border border-line bg-paper p-5">
        <div className="mb-4 text-[15px] font-bold">الزيارات خلال آخر 7 أيام</div>
        <div className="flex h-[120px] items-end gap-4">
          {chart.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full max-w-[36px] rounded-t bg-brand" style={{ height: `${Math.max(4, (d.bar_pct / maxBar) * 100)}px` }} />
              <span className="text-xs text-ink-3">{d.label}</span>
            </div>
          ))}
          {chart.length === 0 && <div className="w-full text-center text-ui text-ink-3">لا توجد بيانات بعد</div>}
        </div>
      </div>

      <div className="grid grid-cols-[2fr_1fr] items-start gap-5 max-lg:grid-cols-1">
        <div className="overflow-hidden rounded-card border border-line bg-paper">
          <div className="border-b border-line px-4.5 py-4 text-[15px] font-bold">أحدث المقالات</div>
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] bg-surface">
            <div className="px-4.5 py-2.5 text-xs font-bold text-ink-3">العنوان</div>
            <div className="px-4.5 py-2.5 text-xs font-bold text-ink-3">القسم</div>
            <div className="px-4.5 py-2.5 text-xs font-bold text-ink-3">الحالة</div>
            <div className="px-4.5 py-2.5 text-xs font-bold text-ink-3">المشاهدات</div>
          </div>
          {(data?.recent_articles ?? []).map((a) => (
            <div key={a.id} className="grid min-h-[44px] grid-cols-[2fr_1fr_1fr_1fr] items-center border-t border-line hover:bg-surface">
              <div className="truncate px-4.5 text-[14.5px] font-semibold text-ink">{a.title}</div>
              <div className="px-4.5 text-[14.5px] text-ink-3">{a.section}</div>
              <div className="px-4.5">
                <StatusBadge status={a.status} />
              </div>
              <div className="tnum px-4.5 text-[14.5px] font-semibold text-ink">{a.views ? a.views.toLocaleString("en-US") : "—"}</div>
            </div>
          ))}
          {(data?.recent_articles ?? []).length === 0 && <div className="p-6 text-center text-ui text-ink-3">لا توجد مقالات بعد</div>}
        </div>
        <div className="rounded-card border border-line bg-paper px-4.5 py-4">
          <div className="mb-3.5 text-[15px] font-bold">طابور المراجعة</div>
          <div className="flex flex-col">
            {(data?.review_queue ?? []).map((q) => (
              <div key={q.id} className="border-b border-line py-3 last:border-b-0">
                <div className="text-[14.5px] font-semibold leading-[1.5] text-ink">{q.title}</div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-xs text-ink-3">{q.author}</span>
                  <Link href={`/dashboard/articles/${q.id}/edit`} className="text-xs font-bold text-brand no-underline">
                    مراجعة
                  </Link>
                </div>
              </div>
            ))}
            {(data?.review_queue ?? []).length === 0 && <div className="py-4 text-center text-ui text-ink-3">لا شيء في الانتظار</div>}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
