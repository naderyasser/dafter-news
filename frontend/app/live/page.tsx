import MostReadList from "@/components/site/MostReadList";
import SiteShell from "@/components/site/SiteShell";
import { getArticles, getLiveStreams, mediaUrl } from "@/lib/api";

export const revalidate = 15;

export default async function LivePage() {
  const [streams, mostRead] = await Promise.all([getLiveStreams(), getArticles("?ordering=-views&page_size=5")]);
  const stream = streams.results.find((s) => s.is_live) ?? streams.results[0];

  return (
    <SiteShell lang="ar" active="live">
      <div className="mx-auto flex max-w-container flex-wrap items-start gap-8 px-6 py-8">
        <main className="min-w-0 flex-[2_1_560px]">
          <div className="relative aspect-video overflow-hidden rounded-card bg-header-bg">
            {stream?.cover_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(stream.cover_image)} alt={stream.title} className="h-full w-full object-cover" />
            ) : null}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[rgba(23,26,31,.55)] text-[26px] text-paper">
                <span className="inline-block -scale-x-100">▶</span>
              </span>
            </div>
            {stream?.is_live && (
              <span className="absolute start-3 top-3 flex items-center gap-1.5 rounded-badge bg-badge-breaking px-2.5 py-1 text-xs font-bold text-paper">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-paper" />
                مباشر
              </span>
            )}
          </div>
          <h1 className="font-display-ar mb-6 mt-4.5 text-[clamp(1.375rem,1rem+1.4vw,1.75rem)] font-extrabold text-ink">
            {stream?.title ?? "لا يوجد بث حالياً"}
          </h1>

          {stream && stream.updates.length > 0 && (
            <>
              <div className="mb-5 border-s-[3px] border-brand ps-3.5">
                <h2 className="font-display-ar m-0 text-h3 font-extrabold text-ink">التغطية لحظة بلحظة</h2>
              </div>
              <div className="relative ps-6">
                <div className="absolute bottom-1.5 top-1.5 start-[7px] w-0.5 bg-line" />
                {stream.updates.map((u) => (
                  <div key={u.id} className="relative pb-7">
                    <div className="absolute -start-6 top-0.5 h-4 w-4 rounded-full border-[3px] border-brand bg-paper" />
                    <div className="tnum mb-1 text-[15px] font-extrabold text-brand">{u.time_label}</div>
                    <div className="text-[15px] leading-[1.7] text-ink">{u.text}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
        <aside className="min-w-[260px] max-w-[320px] flex-[1_1_280px]">
          <MostReadList lang="ar" items={mostRead.results.map((a) => ({ title: a.title, href: `/article/${a.slug}`, section: a.section_name }))} />
        </aside>
      </div>
    </SiteShell>
  );
}
