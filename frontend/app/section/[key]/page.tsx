import { notFound } from "next/navigation";

import MostReadList from "@/components/site/MostReadList";
import SectionFrontBody from "@/components/site/fronts/SectionFrontBody";
import type { FrontStory } from "@/components/site/fronts/types";
import SiteShell from "@/components/site/SiteShell";
import { getArticles, getMatches, getSection, getTicker, getVideos, mediaUrl } from "@/lib/api";
import { relativeTime, standfirstFor } from "@/lib/format";
import { sectionColor } from "@/lib/sections";
import { sectionFront, sectionTagline } from "@/lib/sectionLayout";

export const revalidate = 60;

/**
 * One section page, thirteen fronts.
 *
 * The client rejected the shared-archetype version — read back, four grids
 * across thirteen desks is one page recoloured thirteen times, and it showed.
 * Each desk now owns a component under components/site/fronts with its own
 * masthead and its own structural device; SectionFrontBody picks between them.
 *
 * What stays here is everything that is not layout: fetching, the 404, the
 * «الأكثر قراءة» rail, and the single mapping from API rows to FrontStory. A
 * front receives a list and renders it — so a renamed API field is one edit,
 * and a desk can be moved onto a different front from lib/sectionLayout.ts
 * without this file changing at all.
 */
export default async function SectionPage({ params }: { params: { key: string } }) {
  const front = sectionFront(params.key);

  const [section, articles, mostRead, matches, ticker, videos] = await Promise.all([
    getSection(params.key),
    getArticles(`?language=ar&section__key=${params.key}&ordering=-published_at&page_size=24`),
    getArticles("?language=ar&ordering=-views&page_size=5"),
    front.feed === "matches" ? getMatches() : Promise.resolve(null),
    front.feed === "markets" ? getTicker() : Promise.resolve(null),
    front.feed === "videos" ? getVideos("?page_size=24") : Promise.resolve(null),
  ]);

  if (!section) notFound();

  const accent = sectionColor(params.key);
  const stories: FrontStory[] = articles.results.map((a) => ({
    id: a.id,
    href: `/${a.kind === "opinion" ? "opinion" : "article"}/${a.slug}`,
    title: a.title,
    // Deduplicated once, here: almost every story in the database carries a
    // standfirst identical to its headline, and a front that printed both
    // printed the same sentence twice on every card.
    standfirst: standfirstFor(a.title, a.standfirst),
    imageSrc: mediaUrl(a.cover_image),
    time: relativeTime(a.published_at, "ar"),
    iso: a.published_at,
    badge: a.badge,
    views: a.views,
    country: a.country || undefined,
    subject: a.subcategory || undefined,
    authorName: a.author_name || undefined,
    authorAvatar: mediaUrl(a.author_avatar),
    authorInitial: a.author_initial || undefined,
    comments: a.comment_count,
  }));

  return (
    <SiteShell lang="ar" active={params.key}>
      <div className="mx-auto flex max-w-container flex-wrap items-start gap-10 px-6 py-8">
        <main className="min-w-0 flex-[2_1_560px]">
          <SectionFrontBody
            front={front.front}
            feeds={{ matches, ticker, videos }}
            count={articles.count}
            lang="ar"
            accent={accent}
            sectionKey={params.key}
            title={section.name_ar}
            tagline={sectionTagline(params.key, "ar")}
            stories={stories}
          />
        </main>
        {front.aside && (
          <aside className="min-w-[260px] max-w-[320px] flex-[1_1_280px]">
            <MostReadList
              lang="ar"
              items={mostRead.results.map((a) => ({
                title: a.title,
                href: `/article/${a.slug}`,
                section: a.section_name,
                imageSrc: mediaUrl(a.cover_image),
              }))}
            />
          </aside>
        )}
      </div>
    </SiteShell>
  );
}
