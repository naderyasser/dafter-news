import { notFound } from "next/navigation";

import MarketsSnapshot from "@/components/site/MarketsSnapshot";
import MatchesRail from "@/components/site/MatchesRail";
import MostReadList from "@/components/site/MostReadList";
import OpinionCarousel from "@/components/site/OpinionCarousel";
import SectionGeographic from "@/components/site/SectionGeographic";
import SectionHero from "@/components/site/SectionHero";
import SectionMagazine from "@/components/site/SectionMagazine";
import SectionNewswire from "@/components/site/SectionNewswire";
import SiteShell from "@/components/site/SiteShell";
import { getArticles, getMatches, getSection, getTicker, mediaUrl } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { sectionColor, sectionStyle } from "@/lib/sections";
import { sectionLayout, sectionTagline } from "@/lib/sectionLayout";

export const revalidate = 60;

/**
 * English counterpart of /section/[key] — same archetypes, same opening
 * modules, so switching language never changes what a section IS.
 *
 * The video desk is the one exception: its titles are a single column that
 * currently holds Arabic, so the English edition would render an Arabic
 * grid under an English heading. It falls through to the magazine archetype
 * over whatever English articles the desk has filed instead.
 */
export default async function SectionEnPage({ params }: { params: { key: string } }) {
  const layout = sectionLayout(params.key);

  const [section, articles, mostRead, matches, ticker] = await Promise.all([
    getSection(params.key),
    getArticles(`?language=en&section__key=${params.key}&ordering=-published_at&page_size=24`),
    getArticles("?language=en&ordering=-views&page_size=5"),
    layout.top === "matches" ? getMatches() : Promise.resolve(null),
    layout.top === "markets" ? getTicker() : Promise.resolve(null),
  ]);

  if (!section) notFound();

  const accent = sectionColor(params.key);
  const results = articles.results;

  return (
    <SiteShell lang="en" active={params.key}>
      <div className="mx-auto flex max-w-container flex-wrap items-start gap-10 px-6 py-8">
        <main className="section-watermark min-w-0 flex-[2_1_560px]" style={sectionStyle(params.key)}>
          <SectionHero
            lang="en"
            title={section.name_en || section.name_ar}
            tagline={sectionTagline(params.key, "en")}
            sectionKey={params.key}
            count={articles.count}
          />

          {ticker && <MarketsSnapshot lang="en" data={ticker} />}
          {matches?.results.length ? (
            <div className="mb-2 [&>section]:mx-0 [&>section]:max-w-none [&>section]:px-0 [&>section]:py-0">
              <MatchesRail lang="en" matches={matches.results} />
            </div>
          ) : null}
          {layout.top === "columnists" && results.length > 0 && (
            <div className="mb-7 [&>section]:mx-0 [&>section]:max-w-none [&>section]:px-0 [&>section]:py-0">
              <OpinionCarousel
                lang="en"
                hideHeading
                seeAllHref="/en"
                items={results.map((a) => ({
                  name: a.author_name_en || a.author_name || "",
                  quote: a.title,
                  href: `/en/article/${a.slug}`,
                  initial: a.author_initial || "?",
                }))}
              />
            </div>
          )}

          {layout.archetype === "geographic" ? (
            <SectionGeographic
              lang="en"
              title={section.name_en || section.name_ar}
              href={`/en/section/${params.key}`}
              sectionKey={params.key}
              cards={results.map((a) => ({
                href: `/en/article/${a.slug}`,
                title: a.title,
                kicker: a.subcategory || undefined,
                country: a.country || undefined,
                time: relativeTime(a.published_at, "en"),
                imageSrc: mediaUrl(a.cover_image),
              }))}
            />
          ) : layout.archetype === "magazine" ? (
            <SectionMagazine
              lang="en"
              accent={accent}
              cards={results.map((a) => ({
                id: a.id,
                href: `/en/article/${a.slug}`,
                title: a.title,
                standfirst: a.standfirst || undefined,
                imageSrc: mediaUrl(a.cover_image),
                time: relativeTime(a.published_at, "en"),
                authorName: a.author_name_en || a.author_name || undefined,
                authorAvatar: mediaUrl(a.author_avatar),
                authorInitial: a.author_initial || undefined,
              }))}
            />
          ) : (
            <SectionNewswire
              lang="en"
              accent={accent}
              cards={results.map((a) => ({
                id: a.id,
                href: `/en/article/${a.slug}`,
                title: a.title,
                section: a.section_name,
                time: relativeTime(a.published_at, "en"),
                badge: a.badge,
                imageSrc: mediaUrl(a.cover_image),
                views: a.views,
              }))}
            />
          )}
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
