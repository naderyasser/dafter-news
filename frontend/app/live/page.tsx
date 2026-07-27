import LiveStreamPanel from "@/components/site/LiveStreamPanel";
import MostReadList from "@/components/site/MostReadList";
import SiteShell from "@/components/site/SiteShell";
import { getArticles, getLiveStreams } from "@/lib/api";

export const revalidate = 15;

export default async function LivePage() {
  const [streams, mostRead] = await Promise.all([
    getLiveStreams(),
    getArticles("?language=ar&ordering=-views&page_size=5"),
  ]);
  const stream = streams.results.find((s) => s.is_live) ?? streams.results[0] ?? null;

  return (
    <SiteShell lang="ar" active="live">
      <div className="mx-auto flex max-w-container flex-wrap items-start gap-8 px-6 py-8">
        <main className="min-w-0 flex-[2_1_560px]">
          {/* Server-rendered with the current state, then kept in step from
              the client — see LiveStreamPanel. */}
          <LiveStreamPanel initial={stream} />
        </main>
        <aside className="min-w-[260px] max-w-[320px] flex-[1_1_280px]">
          <MostReadList lang="ar" items={mostRead.results.map((a) => ({ title: a.title, href: `/article/${a.slug}`, section: a.section_name }))} />
        </aside>
      </div>
    </SiteShell>
  );
}
