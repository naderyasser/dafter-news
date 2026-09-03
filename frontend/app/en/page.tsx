import { Suspense } from "react";

import Link from "next/link";

import ArrowCarousel from "@/components/site/ArrowCarousel";
import ArticleCard from "@/components/site/ArticleCard";
import HeroSlider from "@/components/site/HeroSlider";
import LatestNewsTabs from "@/components/site/LatestNewsTabs";
import MostReadList from "@/components/site/MostReadList";
import OpinionCarousel from "@/components/site/OpinionCarousel";
import SectionBlock from "@/components/site/SectionBlock";
import SportsBlock from "@/components/site/SportsBlock";
import SectionDivider from "@/components/site/SectionDivider";
import SectionHeading from "@/components/site/SectionHeading";
import SiteShell from "@/components/site/SiteShell";
import SpecialFilesBlock from "@/components/site/SpecialFilesBlock";
import ReelsRail from "@/components/site/ReelsRail";
import VideoShowcase from "@/components/site/VideoShowcase";
import StoriesRail from "@/components/site/StoriesRail";
import WorldNewsBlock from "@/components/site/WorldNewsBlock";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { getArticles, getMatches, getSections, getStories, getTags, getVideos, mediaUrl, getMostRead, getLatest, getMostCommented, getReels, getSectionFeed, getSiteSettings } from "@/lib/api";
import { REELS_HIDDEN, VIDEO_DESK_HIDDEN, visibleSections } from "@/lib/hiddenDesks";
import { isLatinScript } from "@/lib/format";
import { sectionColor, sectionStyle } from "@/lib/sections";
import type { ArticleCard as ArticleCardType } from "@/lib/types";

// 30s: the ISR window is the ceiling on how fast «الأكثر قراءة» and the
// section blocks can visibly answer a publish or a burst of reads.
export const revalidate = 30;

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
const CURATED_KEYS = ["egypt", "gulf", "world", "economy", "art", "tech", "video", "sports", "opinion", "special"];

const T = {
  egypt: "Egypt",
  gulf: "The Gulf",
  world: "Arab & World",
  economy: "Markets",
  art: "Culture & Art",
  tech: "Science & Tech",
  video: "Watch",
  sports: "Sports",
  special: "Special Files",
  trendingTags: "Trending tags",
};

function toCard(a: ArticleCardType) {
  return {
    href: `/en/article/${a.slug}`,
    title: a.title,
    section: a.section_name,
    badge: a.badge,
    imageSrc: mediaUrl(a.cover_image),
    kind: a.kind,
    authorAvatar: mediaUrl(a.author_avatar),
  };
}

/**
 * Gulf cards carry the country everywhere a label shows — the photo chip
 * and the text-column kicker alike — not just the chip. `section` left at
 * `a.section_name` still printed "The Gulf" under every row regardless of
 * the chip; mirrors the Arabic home's own toGulfCard.
 */
function toGulfCard(a: ArticleCardType) {
  return { ...toCard(a), section: a.country || undefined, chip: a.country || undefined };
}

/** Culture & Art's own corner tag — mirrors the Arabic home's toArtCard. */
function toArtCard(a: ArticleCardType) {
  return { ...toCard(a), chip: a.subcategory || a.section_name };
}

function toWorldCard(a: ArticleCardType) {
  return {
    href: `/en/article/${a.slug}`,
    title: a.title,
    label: a.country || a.subcategory || a.section_name,
    // When the chip carries the country, the topic still gets its line.
    kicker: a.country && a.subcategory ? a.subcategory : undefined,
    imageSrc: mediaUrl(a.cover_image),
  };
}

// -pinned first — mirrors the Arabic home; see its sectionFeed for why.
const sectionFeed = (key: string, size = 6) =>
  getSectionFeed("en", key, size);

async function HomeEnContent() {
  const [pinnedRes, recent, egypt, gulf, world, econ, sports, art, tech, special, videos, opinion, mostRead, tags, popular, stories, sections, matches, reels, settings] =
    await Promise.all([
      getArticles("?language=en&pinned=true&ordering=-published_at&page_size=5"),
      getLatest("en", 12),
      sectionFeed("egypt"),
      sectionFeed("gulf"),
      sectionFeed("world", 7),
      sectionFeed("economy"),
      sectionFeed("sports"),
      sectionFeed("art", 7),
      sectionFeed("tech"),
      sectionFeed("special", 8),
      // Deep enough for the showcase strip to read as a playlist; the English
      // edition also filters this list down to Latin-script titles.
      getVideos("?page_size=12"),
      getArticles("?language=en&kind=opinion&ordering=-published_at&page_size=6"),
      getMostRead("en"),
      getTags(),
      getMostCommented("en"),
      getStories(),
      getSections(),
      getMatches(),
      // «حصل إيه؟» / Catch Up — the same shelf the Arabic home carries. Reels
      // are one shared list, not a per-language one: a reel is a video with a
      // title on it, and the desk publishes one Facebook page for both
      // editions. Settings comes along for that page's URL.
      getReels(),
      getSiteSettings(),
    ]);

  const tailSections = visibleSections(sections.results).filter((s) => !CURATED_KEYS.includes(s.key));
  const tailFeeds = await Promise.all(tailSections.map((s) => sectionFeed(s.key, 4)));
  const tail = tailSections
    .map((section, i) => ({ section, articles: tailFeeds[i].results }))
    .filter(({ articles }) => articles.length);

  // Tag.name, Story.title and Video.title are each a single column holding
  // Arabic, so an LTR page would show Arabic pills, an Arabic stories rail and
  // Arabic video headlines under English headings. Keep only what's written in
  // this page's script; when nothing matches, that strip drops out instead of
  // rendering the wrong language.

  // Pinned first, same as the Arabic home.
  const pinnedIds = new Set(pinnedRes.results.map((a) => a.id));
  const heroPool = [...pinnedRes.results, ...recent.results.filter((a) => !pinnedIds.has(a.id))].slice(0, 5);
  const heroSlides = heroPool.map((a) => ({
    href: `/en/article/${a.slug}`,
    title: a.title,
    section: a.section_name,
    badge: a.badge,
    imageSrc: mediaUrl(a.cover_image),
  }));
  const heroIds = new Set(heroPool.map((a) => a.id));
  const heroSide = recent.results.filter((a) => !heroIds.has(a.id)).slice(0, 4);

  const showcaseVideos = videos.results
    .filter((v) => isLatinScript(v.title))
    .slice(0, 8)
    .map((v) => ({
      id: v.id,
      href: `/en/video/${v.slug}`,
      title: v.title,
      description: v.description,
      poster: mediaUrl(v.cover_image),
      src: mediaUrl(v.file),
      externalUrl: v.external_url,
      durationLabel: v.duration_label,
      isExclusive: v.is_exclusive,
      isLive: v.is_live,
      views: v.views,
      comments: v.comment_count,
    }));

  const specialItems = special.results.map((a) => ({
    href: `/en/article/${a.slug}`,
    title: a.title,
    imageSrc: mediaUrl(a.cover_image),
    authorName: a.author_name_en || a.author_name || undefined,
    authorAvatar: mediaUrl(a.author_avatar),
    authorInitial: a.author_initial || undefined,
  }));

  const opinionItems = opinion.results.map((a) => ({
    // Arabic first/last name columns meant an Arabic byline under an English
    // headline; name_en carries the romanised form.
    name: a.author_name_en || a.author_name || "",
    quote: a.title,
    href: `/en/article/${a.slug}`,
    initial: a.author_initial || "?",
    avatar: mediaUrl(a.author_avatar),
  }));

  const newsLatest = recent.results.slice(0, 6).map((a) => ({
    href: `/en/article/${a.slug}`,
    title: a.title,
    // CTR ask: no relative-time caption on a browsing card — see the
    // Arabic home's own newsLatest for why this is blanked, not dropped.
    time: "",
  }));
  const reelCards = reels.results.map((r) => ({
    id: r.id,
    title: r.title,
    thumbnail: mediaUrl(r.thumbnail),
    href: `/en/reel/${r.slug}`,
  }));

  /** Settings → social links. Undefined hides the rail's footer link rather
   *  than shipping one that goes nowhere — mirrors the Arabic home. */
  const facebookPage =
    settings?.social_links?.find((l) => l.platform === "facebook" && l.url)?.url || undefined;

  const newsPopular = popular.results.map((a) => ({
    href: `/en/article/${a.slug}`,
    title: a.title,
    time: `${a.comment_count} comments`,
  }));

  const enTags = tags.results.filter((t) => isLatinScript(t.name));
  const enStories = stories.results.filter((s) => isLatinScript(s.title));

  return (
    <SiteShell lang="en" active="home">
      <StoriesRail lang="en" stories={enStories} />

      <div className="mx-auto flex max-w-container flex-wrap gap-8 px-6 py-8">
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
                badge={a.badge}
                imageSrc={mediaUrl(a.cover_image)}
                kind={a.kind}
                authorAvatar={mediaUrl(a.author_avatar)}
              />
            </div>
          ))}
        </div>
      </div>

      <SectionDivider />

      <SectionBlock lang="en" title={T.egypt} seeAllHref="/en/section/egypt" cards={egypt.results.map(toCard)} initialCount={4} sectionKey="egypt" />
      {/* SectionBlock hides itself on empty (see its own guard); this
          divider now follows suit — same fix as the Arabic home, and the
          same pattern WorldNewsBlock's own divider already uses below. */}
      {egypt.results.length ? <SectionDivider /> : null}

      {/* «Catch Up» — right after the FIRST curated section, mirroring the
          Arabic home's own placement right after «سياسة» as closely as this
          edition can: the English home curates no Politics block at all
          (there is no `politicsCards` here), so "right after the first real
          section" is the structural equivalent of the client's own "right
          after سياسة" call. Light-themed; see ReelsRail's own docstring. */}
      {!REELS_HIDDEN && reelCards.length ? (
        <>
          <ReelsRail lang="en" reels={reelCards} facebookUrl={facebookPage} />
          <SectionDivider />
        </>
      ) : null}

      {gulf.results.length ? (
        <>
          <SectionBlock lang="en" title={T.gulf} seeAllHref="/en/section/gulf" cards={gulf.results.map(toGulfCard)} initialCount={4} sectionKey="gulf" />
          <SectionDivider />
        </>
      ) : null}

      {/* لقطة وتعليق — the media slot «Catch Up» used to double up in here,
          before it moved up to right after the first section (see above).
          VideoShowcase guards its own empty state, so this is safe to render
          unconditionally now that it is no longer sharing this slot with a
          second component. */}
      {!VIDEO_DESK_HIDDEN && <VideoShowcase lang="en" title={T.video} href="/video" videos={showcaseVideos} />}

      <WorldNewsBlock lang="en" title={T.world} href="/en/section/world" cards={world.results.map(toWorldCard)} sectionKey="world" />
      {world.results.length ? <SectionDivider /> : null}

      <SectionBlock lang="en" title={T.economy} seeAllHref="/en/section/economy" cards={econ.results.map(toCard)} initialCount={4} sectionKey="economy" />
      {/* Same reasoning as the Egypt divider above. */}
      {econ.results.length ? <SectionDivider /> : null}

      {/* Culture & Art — the big photo-first slides, mirroring the Arabic
          home block for block. */}
      {art.results.length ? (
        <>
          <section className="section-watermark mx-auto max-w-container px-6 py-8" style={sectionStyle("art")}>
            <SectionHeading lang="en" title={T.art} href="/en/section/art" sectionKey="art" />
            <ArrowCarousel lang="en" itemClassName="w-[480px] max-w-[88vw]" overlayArrows>
              {art.results.map((a) => (
                <ArticleCard key={a.id} lang="en" variant="hero" {...toArtCard(a)} accent={sectionColor("art")} />
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
      {/* Mirrors the Arabic home's sports band — same pitch, same board.
          TheSportsDB's own strings are English; only the chrome is
          translated, which SportsBlock carries per language. */}
      <SportsBlock lang="en" title={T.sports} href="/en/section/sports" cards={sports.results.map(toCard)} matches={matches.results} />

      {/* Special Files — the magazine shelf, mirroring the Arabic home. */}
      <SpecialFilesBlock lang="en" title={T.special} href="/en/section/special" items={specialItems} />

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
              views: a.views,
              imageSrc: mediaUrl(a.cover_image),
              kind: a.kind,
              authorAvatar: mediaUrl(a.author_avatar),
            }))}
          />
          {enTags.length > 0 && (
            <div className="rounded-card border border-line bg-paper p-5">
              <div className="rule-accent ps-3.5 font-display-en text-[15px] font-extrabold text-ink">{T.trendingTags}</div>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {enTags.slice(0, 5).map((t) => (
                  <Link
                    key={t.id}
                    href={`/en/tag/${encodeURIComponent(t.slug)}`}
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

/** Skeleton inside the page — a loading.tsx here would soft-404 the nested detail routes; see app/page.tsx. */
export default function HomeEnPage() {
  return (
    <Suspense fallback={<PageSkeleton lang="en" variant="home" />}>
      <HomeEnContent />
    </Suspense>
  );
}
