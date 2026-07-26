import DashboardShell from "@/components/dashboard/DashboardShell";
import { getMediaAssets, mediaUrl } from "@/lib/api";

export const revalidate = 0;

export default async function DashMediaPage() {
  const media = await getMediaAssets();
  return (
    <DashboardShell
      active="media"
      breadcrumb="لوحة التحكم / الإدارة"
      title="الوسائط"
      actions={<button className="rounded-lg bg-brand px-4.5 py-2.5 text-[13px] font-bold text-paper hover:bg-brand-strong">⬆ رفع صور متعددة</button>}
    >
      <input
        type="text"
        placeholder="بحث في الوسائط..."
        className="max-w-[360px] rounded-lg border border-line bg-paper px-3.5 py-2.5 text-[13px] outline-none focus:border-brand"
      />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
        {media.results.map((m) => (
          <div key={m.id} className="overflow-hidden rounded-card border border-line bg-paper">
            <div className="aspect-[4/3] bg-surface-2">
              {m.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(m.image)} alt={m.alt} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="flex flex-col gap-1 px-3 py-2.5">
              <span className="truncate text-xs font-semibold text-ink">{m.alt}</span>
              <span className="text-[11px] text-ink-3">{m.credit}</span>
            </div>
          </div>
        ))}
        {media.results.length === 0 && <div className="col-span-full p-8 text-center text-ui text-ink-3">لا توجد وسائط بعد</div>}
      </div>
    </DashboardShell>
  );
}
