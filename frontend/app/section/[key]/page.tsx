import { notFound } from "next/navigation";

import MostReadList from "@/components/site/MostReadList";
import SectionArchive from "@/components/site/SectionArchive";
import SiteShell from "@/components/site/SiteShell";
import { getArticles, getSection, mediaUrl } from "@/lib/api";
import { relativeTime } from "@/lib/format";

export const revalidate = 60;

export default async function SectionPage({ params }: { params: { key: string } }) {
  const [section, articles, mostRead] = await Promise.all([
    getSection(params.key),
    getArticles(`?section__key=${params.key}&ordering=-published_at&page_size=24`),
    getArticles("?ordering=-views&page_size=5"),
  ]);

  if (!section) notFound();

  const cards = articles.results.map((a) => ({
    id: a.id,
    href: `/article/${a.slug}`,
    title: a.title,
    section: a.section_name,
    time: relativeTime(a.published_at, "ar"),
    badge: a.badge,
    imageSrc: mediaUrl(a.cover_image),
    views: a.views,
  }));

  return (
    <SiteShell lang="ar" active={params.key}>
      <div className="mx-auto flex max-w-container flex-wrap items-start gap-10 px-6 py-8">
        <main className="min-w-0 flex-[2_1_560px]">
          <div className="mb-5 border-s-[3px] border-brand ps-4">
            <h1 className="font-display-ar m-0 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)] font-extrabold text-ink">{section.name_ar}</h1>
          </div>
          <SectionArchive lang="ar" cards={cards} />
        </main>
        <aside className="min-w-[260px] max-w-[320px] flex-[1_1_280px]">
          <MostReadList lang="ar" items={mostRead.results.map((a) => ({ title: a.title, href: `/article/${a.slug}`, section: a.section_name }))} />
        </aside>
      </div>
    </SiteShell>
  );
}
