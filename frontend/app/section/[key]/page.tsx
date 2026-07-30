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
import VideoGrid from "@/components/site/VideoGrid";
import { getArticles, getMatches, getSection, getTicker, getVideos, mediaUrl } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { sectionColor, sectionStyle } from "@/lib/sections";
import { sectionLayout, sectionTagline } from "@/lib/sectionLayout";

export const revalidate = 60;

/**
 * One section page, three grids, and an opening module chosen by subject.
 *
 * The client asked for «تصميم فريد لكل قسم». Thirteen hand-written pages
 * would have delivered that and then charged rent forever — every shared
 * concern added later would need thirteen edits. What actually makes a
 * section feel like itself is that it opens with the thing it is about
 * (prices, fixtures, a player, its columnists) and then lays its stories
 * out the way that desk is read: scanned, browsed, or filtered by country.
 * See lib/sectionLayout.ts for the mapping.
 */
export default async function SectionPage({ params }: { params: { key: string } }) {
  const layout = sectionLayout(params.key);

  const [section, articles, mostRead, matches, ticker, videos] = await Promise.all([
    getSection(params.key),
    getArticles(`?language=ar&section__key=${params.key}&ordering=-published_at&page_size=24`),
    getArticles("?language=ar&ordering=-views&page_size=5"),
    layout.top === "matches" ? getMatches() : Promise.resolve(null),
    layout.top === "markets" ? getTicker() : Promise.resolve(null),
    layout.top === "videos" ? getVideos("?page_size=24") : Promise.resolve(null),
  ]);

  if (!section) notFound();

  const accent = sectionColor(params.key);
  const results = articles.results;

  return (
    <SiteShell lang="ar" active={params.key}>
      <div className="mx-auto flex max-w-container flex-wrap items-start gap-10 px-6 py-8">
        <main className="section-watermark min-w-0 flex-[2_1_560px]" style={sectionStyle(params.key)}>
          <SectionHero
            lang="ar"
            title={section.name_ar}
            tagline={sectionTagline(params.key, "ar")}
            sectionKey={params.key}
            count={layout.top === "videos" ? undefined : articles.count}
          />

          {/* The opening module — the section's subject, not its decoration. */}
          {ticker && <MarketsSnapshot lang="ar" data={ticker} />}
          {matches?.results.length ? (
            <div className="mb-2 [&>section]:mx-0 [&>section]:max-w-none [&>section]:px-0 [&>section]:py-0">
              <MatchesRail lang="ar" matches={matches.results} />
            </div>
          ) : null}
          {layout.top === "columnists" && results.length > 0 && (
            <div className="mb-7 [&>section]:mx-0 [&>section]:max-w-none [&>section]:px-0 [&>section]:py-0">
              <OpinionCarousel
                lang="ar"
                hideHeading
                seeAllHref="/opinion"
                items={results.map((a) => ({
                  name: a.author_name || "",
                  quote: a.title,
                  href: `/opinion/${a.slug}`,
                  initial: a.author_initial || "؟",
                }))}
              />
            </div>
          )}

          {/* «لقطة وتعليق» holds videos, not articles — the grid that reads
              the article table would render an empty section forever. */}
          {layout.top === "videos" ? (
            <VideoGrid
              items={(videos?.results ?? [])
                .filter((v) => /[؀-ۿ]/.test(v.title))
                .map((v) => ({
                  id: v.id,
                  href: `/video/${v.slug}`,
                  title: v.title,
                  section: v.section_name || "",
                  time: relativeTime(v.created_at, "ar"),
                  badge: (v.is_exclusive ? "exclusive" : "none") as "none" | "exclusive",
                  imageSrc: mediaUrl(v.cover_image),
                  duration: v.duration_label,
                  comments: v.comment_count,
                }))}
            />
          ) : layout.archetype === "geographic" ? (
            <SectionGeographic
              lang="ar"
              title={section.name_ar}
              href={`/section/${params.key}`}
              sectionKey={params.key}
              cards={results.map((a) => ({
                href: `/article/${a.slug}`,
                title: a.title,
                kicker: a.subcategory || undefined,
                country: a.country || undefined,
                time: relativeTime(a.published_at, "ar"),
                imageSrc: mediaUrl(a.cover_image),
              }))}
            />
          ) : layout.archetype === "magazine" ? (
            <SectionMagazine
              lang="ar"
              accent={accent}
              cards={results.map((a) => ({
                id: a.id,
                href: `/${a.kind === "opinion" ? "opinion" : "article"}/${a.slug}`,
                title: a.title,
                standfirst: a.standfirst || undefined,
                imageSrc: mediaUrl(a.cover_image),
                time: relativeTime(a.published_at, "ar"),
                authorName: a.author_name || undefined,
                authorAvatar: mediaUrl(a.author_avatar),
                authorInitial: a.author_initial || undefined,
              }))}
            />
          ) : (
            <SectionNewswire
              lang="ar"
              accent={accent}
              cards={results.map((a) => ({
                id: a.id,
                href: `/article/${a.slug}`,
                title: a.title,
                section: a.section_name,
                time: relativeTime(a.published_at, "ar"),
                badge: a.badge,
                imageSrc: mediaUrl(a.cover_image),
                views: a.views,
              }))}
            />
          )}
        </main>
        <aside className="min-w-[260px] max-w-[320px] flex-[1_1_280px]">
          <MostReadList
            lang="ar"
            items={mostRead.results.map((a) => ({
              title: a.title,
              href: `/article/${a.slug}`,
              section: a.section_name,
              // The thumbnails were never passed here, so every one of the
              // thirteen section pages showed a column of grey boxes.
              imageSrc: mediaUrl(a.cover_image),
            }))}
          />
        </aside>
      </div>
    </SiteShell>
  );
}
