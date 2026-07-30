import { notFound } from "next/navigation";

import MostReadList from "@/components/site/MostReadList";
import SectionArchive from "@/components/site/SectionArchive";
import SiteShell from "@/components/site/SiteShell";
import { getArticles, getSection, mediaUrl } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { sectionColor, sectionStyle } from "@/lib/sections";

export const revalidate = 60;

/**
 * English counterpart of /section/[key].
 *
 * The English nav used to point every section at "#", so there was nowhere
 * to go from the home page's section headings — a reader who switched
 * language lost the ability to browse a section at all.
 */
export default async function SectionEnPage({ params }: { params: { key: string } }) {
  const [section, articles, mostRead] = await Promise.all([
    getSection(params.key),
    getArticles(`?language=en&section__key=${params.key}&ordering=-published_at&page_size=24`),
    getArticles("?language=en&ordering=-views&page_size=5"),
  ]);

  if (!section) notFound();

  const cards = articles.results.map((a) => ({
    id: a.id,
    href: `/en/article/${a.slug}`,
    title: a.title,
    section: a.section_name,
    time: relativeTime(a.published_at, "en"),
    badge: a.badge,
    imageSrc: mediaUrl(a.cover_image),
    views: a.views,
    // The country rides the photo in the two geographic sections only.
    chip: params.key === "gulf" || params.key === "world" ? a.country || undefined : undefined,
  }));

  return (
    <SiteShell lang="en" active={params.key}>
      <div className="mx-auto flex max-w-container flex-wrap items-start gap-10 px-6 py-8">
        <main className="section-watermark min-w-0 flex-[2_1_560px]" style={sectionStyle(params.key)}>
          <div className="rule-accent mb-5 ps-4">
            <h1 className="font-display-en m-0 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)] font-extrabold text-ink">
              {section.name_en || section.name_ar}
            </h1>
          </div>
          <SectionArchive lang="en" cards={cards} accent={sectionColor(params.key)} />
        </main>
        <aside className="min-w-[260px] max-w-[320px] flex-[1_1_280px]">
          <MostReadList
            lang="en"
            items={mostRead.results.map((a) => ({
              title: a.title,
              href: `/en/article/${a.slug}`,
              section: a.section_name,
              imageSrc: mediaUrl(a.cover_image),
            }))}
          />
        </aside>
      </div>
    </SiteShell>
  );
}
