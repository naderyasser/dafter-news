import DashboardShell from "@/components/dashboard/DashboardShell";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { getAuthors, getArticles, mediaUrl, FRESH } from "@/lib/api";
import { formatDate, toEasternNumerals } from "@/lib/format";

export const revalidate = 0;

export default async function DashOpinionPage() {
  const [authors, opinionArticles] = await Promise.all([getAuthors(FRESH), getArticles("?kind=opinion&page_size=50", FRESH)]);

  return (
    <DashboardShell active="opinion" breadcrumb="لوحة التحكم / الوسائط والبث" title="بالعقل والمنطق">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[15px] font-bold">الكتّاب</span>
          <button className="rounded-pill bg-surface px-4 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-surface-2">+ كاتب جديد</button>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
          {authors.results.map((a) => (
            <div key={a.id} className="flex flex-col items-center gap-2 rounded-card border border-line bg-paper p-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-brand-tint text-[18px] font-extrabold text-brand">
                {a.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(a.avatar)} alt={a.name} className="h-full w-full object-cover" />
                ) : (
                  a.initial
                )}
              </div>
              <span className="text-[13.5px] font-bold">{a.name}</span>
              <span className="text-[11.5px] text-ink-3">{toEasternNumerals(a.article_count)} مقال رأي</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 text-[15px] font-bold">مقالات الرأي</div>
        <div className="overflow-hidden rounded-card border border-line bg-paper">
          <div className="grid grid-cols-[2.4fr_1fr_1fr_1fr] bg-surface">
            <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">العنوان</div>
            <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">الكاتب</div>
            <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">الحالة</div>
            <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">التاريخ</div>
          </div>
          {opinionArticles.results.map((o) => (
            <div key={o.id} className="grid min-h-[48px] grid-cols-[2.4fr_1fr_1fr_1fr] items-center border-t border-line">
              <div className="px-3.5 text-[13.5px] font-semibold text-ink">{o.title}</div>
              <div className="px-3.5 text-[13.5px] text-ink-3">{o.author_name}</div>
              <div className="px-3.5">
                <StatusBadge status={o.status} />
              </div>
              <div className="px-3.5 text-[13.5px] text-ink-3">{formatDate(o.published_at, "ar") || "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
