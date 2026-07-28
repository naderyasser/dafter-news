import Link from "next/link";

import ArrowCarousel from "@/components/site/ArrowCarousel";
import ArticleCard from "@/components/site/ArticleCard";
import HeroSlider from "@/components/site/HeroSlider";
import LatestNewsTabs from "@/components/site/LatestNewsTabs";
import MatchesRail from "@/components/site/MatchesRail";
import MostReadList from "@/components/site/MostReadList";
import OpinionCarousel from "@/components/site/OpinionCarousel";
import SectionBlock from "@/components/site/SectionBlock";
import SectionDivider from "@/components/site/SectionDivider";
import SectionHeading from "@/components/site/SectionHeading";
import SiteShell from "@/components/site/SiteShell";
import VerticalNewsCarousel from "@/components/site/VerticalNewsCarousel";
import StoriesRail from "@/components/site/StoriesRail";
import WorldNewsBlock from "@/components/site/WorldNewsBlock";
import { getLiveStreams, getArticles, getMatches, getSections, getStories, getTags, getVideos, mediaUrl } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { sectionColor, sectionStyle } from "@/lib/sections";
import type { ArticleCard as ArticleCardType, Badge } from "@/lib/types";

export const revalidate = 60;

/**
 * Mirrors app/page.tsx block for block.
 *
 * Switching language used to swap the whole layout: the English home was a
 * static hero and three section blocks against the Arabic side's rotating
 * hero, stories rail, twelve sections, video row and match rail. Readers
 * changed one setting and landed on what looked like a different site. The
 * two pages now share every component and differ only in language, direction
 * and which articles they query.
 */
const CURATED_KEYS = ["egypt", "gulf", "world", "economy", "art", "tech", "video", "sports", "opinion"];

const T = {
  egypt: "Egypt",
  gulf: "The Gulf",
  world: "Arab & World",
  economy: "Markets",
  art: "Culture & Art",
  tech: "Science & Tech",
  video: "Watch",
  sports: "Sports",
  trendingTags: "Trending tags",
  liveCoverage: "Live coverage",
};

function toCard(a: ArticleCardType) {
  return {
    href: `/en/article/${a.slug}`,
    title: a.title,
    section: a.section_name,
    time: relativeTime(a.published_at, "en"),
    badge: a.badge,
    imageSrc: mediaUrl(a.cover_image),
  };
}

function toWorldCard(a: ArticleCardType) {
  return {
    href: `/en/article/${a.slug}`,
    title: a.title,
    label: a.subcategory || a.section_name,
    time: relativeTime(a.published_at, "en"),
    imageSrc: mediaUrl(a.cover_image),
  };
}

const sectionFeed = (key: string, size = 6) =>
  getArticles(`?language=en&section__key=${key}&ordering=-published_at&page_size=${size}`);

export default async function HomeEnPage() {
  const [pinnedRes, recent, egypt, gulf, world, econ, sports, art, tech, videos, opinion, mostRead, tags, popular, stories, sections, breaking, streams, matches] =
    await Promise.all([
      getArticles("?language=en&pinned=true&ordering=-published_at&page_size=5"),
      getArticles("?language=en&ordering=-published_at&page_size=12"),
      sectionFeed("egypt"),
      sectionFeed("gulf"),
      sectionFeed("world", 7),
      sectionFeed("economy"),
      sectionFeed("sports"),
      sectionFeed("art", 7),
      sectionFeed("tech"),
      getVideos("?page_size=4"),
      getArticles("?language=en&kind=opinion&page_size=6"),
      getArticles("?language=en&ordering=-views&page_size=5"),
      getTags(),
      getArticles("?language=en&ordering=-comment_count&page_size=6"),
      getStories(),
      getSections(),
      getArticles("?language=en&badge=breaking&ordering=-published_at&page_size=5"),
      getLiveStreams(),
      getMatches(),
    ]);

  const tailSections = sections.results.filter((s) => !CURATED_KEYS.includes(s.key));
  const tailFeeds = await Promise.all(tailSections.map((s) => sectionFeed(s.key, 4)));
  const tail = tailSections
    .map((section, i) => ({ section, articles: tailFeeds[i].results }))
    .filter(({ articles }) => articles.length);

  // Tag.name, Story.title and Video.title are each a single column holding
  // Arabic, so an LTR page would show Arabic pills, an Arabic stories rail and
  // Arabic video headlines under English headings. Keep only what's written in
  // this page's script; when nothing matches, that strip drops out instead of
  // rendering the wrong language.
  const isLatin = (s: string) => !/[؀-ۿ]/.test(s);


  /**
   * The vertical carousel takes what is actually breaking; when nothing
   * carries the «عاجل» badge it falls back to the most recent stories, so the
   * block is never a heading with an empty frame under it.
   */
  const liveItems = (breaking.results.length ? breaking.results : recent.results.slice(0, 5)).map((a) => ({
    href: `/en/article/${a.slug}`,
    title: a.title,
    kicker: a.subcategory || a.section_name,
    time: relativeTime(a.published_at, "en"),
    imageSrc: mediaUrl(a.cover_image),
  }));
  const isLive = streams.results.some((s) => s.is_live);

  // Pinned first, same as the Arabic home.
  const pinnedIds = new Set(pinnedRes.results.map((a) => a.id));
  const heroPool = [...pinnedRes.results, ...recent.results.filter((a) => !pinnedIds.has(a.id))].slice(0, 5);
  const heroSlides = heroPool.map((a) => ({
    href: `/en/article/${a.slug}`,
    title: a.title,
    section: a.section_name,
    time: relativeTime(a.published_at, "en"),
    badge: a.badge,
    imageSrc: mediaUrl(a.cover_image),
  }));
  const heroIds = new Set(heroPool.map((a) => a.id));
  const heroSide = recent.results.filter((a) => !heroIds.has(a.id)).slice(0, 4);

  const videoCards = videos.results
    .filter((v) => isLatin(v.title))
    .map((v) => ({
      href: `/video/${v.slug}`,
      title: v.title,
      section: T.video,
      time: relativeTime(v.created_at, "en"),
      badge: (v.is_exclusive ? "exclusive" : "none") as Badge,
      imageSrc: mediaUrl(v.cover_image),
      isVideo: true,
      videoDuration: v.duration_label,
      comments: v.comment_count,
    }));

  const opinionItems = opinion.results.map((a) => ({
    // Arabic first/last name columns meant an Arabic byline under an English
    // headline; name_en carries the romanised form.
    name: a.author_name_en || a.author_name || "",
    quote: a.title,
    href: `/en/article/${a.slug}`,
    initial: a.author_initial || "?",
  }));

  const newsLatest = recent.results.slice(0, 6).map((a) => ({
    href: `/en/article/${a.slug}`,
    title: a.title,
    time: relativeTime(a.published_at, "en"),
  }));
  const newsPopular = popular.results.map((a) => ({
    href: `/en/article/${a.slug}`,
    title: a.title,
    time: `${a.comment_count} comments`,
  }));

  const enTags = tags.results.filter((t) => isLatin(t.name));
  const enStories = stories.results.filter((s) => isLatin(s.title));

  return (
    <SiteShell lang="en" active="home">
      <StoriesRail lang="en" stories={enStories} />

      <div className="mx-auto flex max-w-container flex-wrap gap-5 px-6 py-6">
        <div className="min-w-0 flex-[2_1_480px]">
          <HeroSlider lang="en" slides={heroSlides} />
        </div>
        <div className="min-w-0 flex-[1_1_300px]">
          {heroSide.map((a, i) => (
            <div key={a.id} className={i === heroSide.length - 1 ? "" : "mb-3.5 border-b border-line pb-3.5"}>
              <ArticleCard
                lang="en"
                variant="compact"
                href={`/en/article/${a.slug}`}
                title={a.title}
                section={a.section_name}
                time={relativeTime(a.published_at, "en")}
                badge={a.badge}
                imageSrc={mediaUrl(a.cover_image)}
              />
            </div>
          ))}
        </div>
      </div>

      <VerticalNewsCarousel lang="en" items={liveItems} isLive={isLive} heading={T.liveCoverage} />
      <SectionDivider />

      <SectionBlock lang="en" title={T.egypt} seeAllHref="/en/section/egypt" cards={egypt.results.map(toCard)} initialCount={4} sectionKey="egypt" />
      <SectionDivider />

      {gulf.results.length ? (
        <>
          <SectionBlock lang="en" title={T.gulf} seeAllHref="/en/section/gulf" cards={gulf.results.map(toCard)} initialCount={4} sectionKey="gulf" />
          <SectionDivider />
        </>
      ) : null}

      {/* Video desk third in the page order, mirroring the Arabic home.
          Hidden until there are English video headlines — a heading with no
          cards under it reads as a broken block. */}
      {videoCards.length ? (
        <>
          <SectionBlock lang="en" title={T.video} seeAllHref="/video" cards={videoCards} initialCount={4} sectionKey="video" />
          <SectionDivider />
        </>
      ) : null}

      <WorldNewsBlock lang="en" title={T.world} href="/en/section/world" cards={world.results.map(toWorldCard)} sectionKey="world" />
      {world.results.length ? <SectionDivider /> : null}

      <SectionBlock lang="en" title={T.economy} seeAllHref="/en/section/economy" cards={econ.results.map(toCard)} initialCount={4} sectionKey="economy" />
      <SectionDivider />

      {/* Culture & Art as the arrow-navigated rail, mirroring the Arabic
          home block for block. */}
      {art.results.length ? (
        <>
          <section className="section-watermark mx-auto max-w-container px-6 py-8" style={sectionStyle("art")}>
            <SectionHeading lang="en" title={T.art} href="/en/section/art" sectionKey="art" />
            <ArrowCarousel lang="en" itemClassName="w-[300px]">
              {art.results.map((a) => (
                <ArticleCard key={a.id} lang="en" variant="standard" {...toCard(a)} accent={sectionColor("art")} />
              ))}
            </ArrowCarousel>
          </section>
          <SectionDivider />
        </>
      ) : null}

      {tech.results.length ? (
        <section className="section-watermark mx-auto max-w-container px-6 py-8" style={sectionStyle("tech")}>
          <SectionHeading lang="en" title={T.tech} href="/en/section/tech" sectionKey="tech" />
          <ArrowCarousel lang="en" itemClassName="w-[300px]">
            {tech.results.map((a) => (
              <ArticleCard key={a.id} lang="en" variant="standard" {...toCard(a)} accent={sectionColor("tech")} />
            ))}
          </ArrowCarousel>
        </section>
      ) : null}

      <SectionDivider />
      <SectionBlock lang="en" title={T.sports} seeAllHref="/en/section/sports" cards={sports.results.map(toCard)} initialCount={4} sectionKey="sports" />
      {/* TheSportsDB's own strings are English — the rail only ever needed
          its chrome translated, which MatchesRail now carries per language. */}
      <MatchesRail lang="en" matches={matches.results} />

      {tail.map(({ section, articles }) => (
        <div key={section.key}>
          <SectionDivider />
          <SectionBlock
            lang="en"
            title={section.name_en || section.name_ar}
            seeAllHref={`/en/section/${section.key}`}
            cards={articles.map(toCard)}
            initialCount={4}
            sectionKey={section.key}
          />
        </div>
      ))}

      {opinionItems.length > 0 && <OpinionCarousel lang="en" items={opinionItems} seeAllHref="/en" />}

      <div className="mx-auto flex max-w-container flex-wrap items-start gap-8 px-6 py-8">
        <LatestNewsTabs lang="en" latest={newsLatest} popular={newsPopular} />
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
          {/* The thumbnails were simply never passed here, so the English
              «Most read» rail rendered grey boxes down the side. */}
          <MostReadList
            lang="en"
            items={mostRead.results.map((a) => ({
              title: a.title,
              href: `/en/article/${a.slug}`,
              section: a.section_name,
              imageSrc: mediaUrl(a.cover_image),
            }))}
          />
          {enTags.length > 0 && (
            <div className="rounded-card border border-line bg-paper p-5">
              <div className="rule-accent ps-3.5 font-display-en text-[15px] font-extrabold text-ink">{T.trendingTags}</div>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {enTags.slice(0, 5).map((t) => (
                  <Link
                    key={t.id}
                    href={`/tag/${encodeURIComponent(t.slug)}`}
                    className="rounded-pill bg-brand-tint px-3.5 py-1.5 text-[13px] font-semibold text-brand no-underline hover:bg-brand hover:text-paper"
                  >
                    {t.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
