import { Suspense } from "react";

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
import SpecialFilesBlock from "@/components/site/SpecialFilesBlock";
import VerticalNewsCarousel from "@/components/site/VerticalNewsCarousel";
import VideoShowcase from "@/components/site/VideoShowcase";
import StoriesRail from "@/components/site/StoriesRail";
import WorldNewsBlock from "@/components/site/WorldNewsBlock";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { getLiveStreams, getArticles, getMatches, getSections, getStories, getTags, getVideos, mediaUrl } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { sectionColor, sectionStyle } from "@/lib/sections";
import type { ArticleCard as ArticleCardType } from "@/lib/types";

export const revalidate = 60;

/**
 * Sections this page lays out by hand, in the order they appear below. Every
 * other section is appended automatically by the tail loop, so adding one in
 * the dashboard puts it on the home page instead of stranding it on a
 * /section/… page no reader navigates to.
 */
const CURATED_KEYS = ["egypt", "gulf", "world", "economy", "art", "tech", "video", "sports", "opinion", "special"];

function toSectionCard(a: ArticleCardType) {
  return {
    href: `/article/${a.slug}`,
    title: a.title,
    section: a.section_name,
    time: relativeTime(a.published_at, "ar"),
    badge: a.badge,
    imageSrc: mediaUrl(a.cover_image),
  };
}

/** Gulf cards carry the country on the photo — and only the gulf ones;
 *  the other section grids stay clean, per the client. */
function toGulfCard(a: ArticleCardType) {
  return { ...toSectionCard(a), chip: a.country || undefined };
}

function toWorldCard(a: ArticleCardType) {
  return {
    href: `/article/${a.slug}`,
    title: a.title,
    // Country first (the client's geographic chip), then the editorial
    // subcategory, then the section name — so the chip is never blank.
    label: a.country || a.subcategory || a.section_name,
    // When the chip carries the country, the topic still gets its line.
    kicker: a.country && a.subcategory ? a.subcategory : undefined,
    time: relativeTime(a.published_at, "ar"),
    imageSrc: mediaUrl(a.cover_image),
  };
}

const sectionFeed = (key: string, size = 6) =>
  getArticles(`?language=ar&section__key=${key}&ordering=-published_at&page_size=${size}`);

async function HomeContent() {
  const [pinnedRes, recent, egypt, gulf, world, econ, sports, art, tech, special, videos, opinion, mostRead, tags, popular, stories, matches, sections, breaking, streams] =
    await Promise.all([
      getArticles("?language=ar&pinned=true&ordering=-published_at&page_size=5"),
      getArticles("?language=ar&ordering=-published_at&page_size=12"),
      sectionFeed("egypt"),
      sectionFeed("gulf"),
      sectionFeed("world", 7),
      sectionFeed("economy"),
      sectionFeed("sports"),
      sectionFeed("art", 7),
      sectionFeed("tech"),
      sectionFeed("special", 8),
      // Deeper than the four a grid needed: the showcase's thumbnail strip is
      // the section's navigation, and it only reads as a playlist with a
      // playlist's worth of tiles in it.
      getVideos("?page_size=12"),
      getArticles("?language=ar&kind=opinion&page_size=6"),
      getArticles("?language=ar&ordering=-views&page_size=5"),
      getTags(),
      getArticles("?language=ar&ordering=-comment_count&page_size=6"),
      getStories(),
      getMatches(),
      getSections(),
      getArticles("?language=ar&badge=breaking&ordering=-published_at&page_size=5"),
      getLiveStreams(),
    ]);

  // Symmetric with /en's isLatin filter: stories, videos and tags are
  // single-column fields that now hold BOTH languages in the seed, so each
  // edition takes only what is written in its own script — without this the
  // English rows would surface under Arabic headings here.
  const isArabicText = (t: string) => /[؀-ۿ]/.test(t);
  const arStories = stories.results.filter((st) => isArabicText(st.title));
  const arVideos = videos.results.filter((v) => isArabicText(v.title));
  const arTags = tags.results.filter((t) => isArabicText(t.name));

  // The tail: every section without a bespoke block above. Empty ones are
  // dropped rather than rendered as a bare heading.
  const tailSections = sections.results.filter((s) => !CURATED_KEYS.includes(s.key));
  const tailFeeds = await Promise.all(tailSections.map((s) => sectionFeed(s.key, 4)));
  const tail = tailSections
    .map((section, i) => ({ section, articles: tailFeeds[i].results }))
    .filter(({ articles }) => articles.length);


  /**
   * The vertical carousel takes what is actually breaking; when nothing
   * carries the «عاجل» badge it falls back to the most recent stories, so the
   * block is never a heading with an empty frame under it.
   */
  const liveItems = (breaking.results.length ? breaking.results : recent.results.slice(0, 5)).map((a) => ({
    href: `/article/${a.slug}`,
    title: a.title,
    kicker: a.subcategory || a.section_name,
    time: relativeTime(a.published_at, "ar"),
    imageSrc: mediaUrl(a.cover_image),
  }));
  const isLive = streams.results.some((s) => s.is_live);

  // The hero rotates the top stories — pinned first («تثبيت في الرئيسية»
  // from the editor), the latest filling whatever slots remain. The side
  // rail carries what isn't in it.
  const pinnedIds = new Set(pinnedRes.results.map((a) => a.id));
  const heroPool = [...pinnedRes.results, ...recent.results.filter((a) => !pinnedIds.has(a.id))].slice(0, 5);
  const heroSlides = heroPool.map((a) => ({
    href: `/article/${a.slug}`,
    title: a.title,
    section: a.section_name,
    time: relativeTime(a.published_at, "ar"),
    badge: a.badge,
    imageSrc: mediaUrl(a.cover_image),
  }));
  const heroIds = new Set(heroPool.map((a) => a.id));
  const heroSide = recent.results.filter((a) => !heroIds.has(a.id)).slice(0, 4);

  const showcaseVideos = arVideos.slice(0, 8).map((v) => ({
    id: v.id,
    href: `/video/${v.slug}`,
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
    time: relativeTime(v.created_at, "ar"),
  }));

  const specialItems = special.results.map((a) => ({
    href: `/article/${a.slug}`,
    title: a.title,
    imageSrc: mediaUrl(a.cover_image),
    authorName: a.author_name || undefined,
    authorAvatar: mediaUrl(a.author_avatar),
    authorInitial: a.author_initial || undefined,
  }));

  const opinionItems = opinion.results.map((a) => ({
    name: a.author_name || "",
    quote: a.title,
    href: `/opinion/${a.slug}`,
    initial: a.author_initial || "؟",
  }));

  const newsLatest = recent.results.slice(0, 6).map((a) => ({
    href: `/article/${a.slug}`,
    title: a.title,
    time: relativeTime(a.published_at, "ar"),
  }));
  const newsPopular = popular.results.map((a) => ({
    href: `/article/${a.slug}`,
    title: a.title,
    time: `${a.comment_count} تعليق`,
  }));

  return (
    <SiteShell lang="ar" active="home">
      <StoriesRail lang="ar" stories={arStories} />

      <div className="mx-auto flex max-w-container flex-wrap gap-5 px-6 py-6">
        <div className="min-w-0 flex-[2_1_480px]">
          <HeroSlider lang="ar" slides={heroSlides} />
        </div>
        <div className="min-w-0 flex-[1_1_300px]">
          {heroSide.map((a, i) => (
            <div key={a.id} className={i === heroSide.length - 1 ? "" : "mb-3.5 border-b border-line pb-3.5"}>
              <ArticleCard
                lang="ar"
                variant="compact"
                href={`/article/${a.slug}`}
                title={a.title}
                section={a.section_name}
                time={relativeTime(a.published_at, "ar")}
                badge={a.badge}
                imageSrc={mediaUrl(a.cover_image)}
              />
            </div>
          ))}
        </div>
      </div>

      <VerticalNewsCarousel lang="ar" items={liveItems} isLive={isLive} heading="التغطية المباشرة" />
      <SectionDivider />

      <SectionBlock lang="ar" title="شؤون مصر" seeAllHref="/section/egypt" cards={egypt.results.map(toSectionCard)} initialCount={4} sectionKey="egypt" />
      <SectionDivider />

      {gulf.results.length ? (
        <>
          <SectionBlock lang="ar" title="الخليج العربي" seeAllHref="/section/gulf" cards={gulf.results.map(toGulfCard)} initialCount={4} sectionKey="gulf" />
          <SectionDivider />
        </>
      ) : null}

      {/* لقطة وتعليق — third in the page order on the client's request: the
          video desk is a flagship, so it sits with the lead sections rather
          than below the fold. It gets the player treatment rather than a grid
          of cards, and no divider after it: the navy band's own bottom edge
          already separates it from what follows. */}
      <VideoShowcase lang="ar" title="لقطة وتعليق" href="/video" videos={showcaseVideos} />

      {/* عرب وعالم — its own front-page treatment (lead + rail + tiles, red
          category chips on the photos), deliberately not a grid shared with
          any other section: the client asked for this design to be this
          section's alone. */}
      <WorldNewsBlock lang="ar" title="عرب وعالم" href="/section/world" cards={world.results.map(toWorldCard)} sectionKey="world" />
      {world.results.length ? <SectionDivider /> : null}

      <SectionBlock lang="ar" title="حركة السوق" seeAllHref="/section/economy" cards={econ.results.map(toSectionCard)} initialCount={4} sectionKey="economy" />
      <SectionDivider />

      {/* ثقافة وفن — the arrow-navigated rail, upgraded to the big
          photo-first slides of the client's reference: hero cards with the
          title on the image, rather than another row of 300px news tiles. */}
      {art.results.length ? (
        <>
          <section className="section-watermark mx-auto max-w-container px-6 py-8" style={sectionStyle("art")}>
            <SectionHeading lang="ar" title="ثقافة وفن" href="/section/art" sectionKey="art" />
            <ArrowCarousel lang="ar" itemClassName="w-[480px] max-w-[88vw]">
              {art.results.map((a) => (
                <ArticleCard key={a.id} lang="ar" variant="hero" {...toSectionCard(a)} />
              ))}
            </ArrowCarousel>
          </section>
          <SectionDivider />
        </>
      ) : null}

      {/* علوم وتكنولوجيا — arrow-navigated rail (the عكاظ pattern). */}
      {tech.results.length ? (
        <section className="section-watermark mx-auto max-w-container px-6 py-8" style={sectionStyle("tech")}>
          <SectionHeading lang="ar" title="علوم وتكنولوجيا" href="/section/tech" sectionKey="tech" />
          <ArrowCarousel lang="ar" itemClassName="w-[300px]">
            {tech.results.map((a) => (
              <ArticleCard key={a.id} lang="ar" variant="standard" {...toSectionCard(a)} accent={sectionColor("tech")} />
            ))}
          </ArrowCarousel>
        </section>
      ) : null}

      <SectionDivider />
      <SectionBlock lang="ar" title="جوّه الجون" seeAllHref="/section/sports" cards={sports.results.map(toSectionCard)} initialCount={4} sectionKey="sports" />
      <MatchesRail lang="ar" matches={matches.results} />

      {/* ملف خاص — the magazine shelf. No divider before it: like the video
          showcase, its own dark band is the separation. */}
      <SpecialFilesBlock lang="ar" title="ملف خاص" href="/section/special" items={specialItems} />

      {/* أمن ومحاكم / ملف خاص / دليلك الأول — and anything added later.
          Rendered here rather than left to /section/… pages. */}
      {tail.map(({ section, articles }) => (
        <div key={section.key}>
          <SectionDivider />
          <SectionBlock
            lang="ar"
            title={section.name_ar}
            seeAllHref={`/section/${section.key}`}
            cards={articles.map(toSectionCard)}
            initialCount={4}
            sectionKey={section.key}
          />
        </div>
      ))}

      <OpinionCarousel lang="ar" items={opinionItems} seeAllHref="/opinion" />

      <div className="mx-auto flex max-w-container flex-wrap items-start gap-8 px-6 py-8">
        <LatestNewsTabs lang="ar" latest={newsLatest} popular={newsPopular} />
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
          <MostReadList
            lang="ar"
            items={mostRead.results.map((a) => ({
              title: a.title,
              href: `/article/${a.slug}`,
              section: a.section_name,
              imageSrc: mediaUrl(a.cover_image),
            }))}
          />
          <div className="rounded-card border border-line bg-paper p-5">
            <div className="rule-accent ps-3.5 font-display-ar text-[15px] font-extrabold text-ink">وسوم رائجة</div>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {arTags.slice(0, 5).map((t) => (
                <Link
                  key={t.id}
                  href={`/tag/${t.slug}`}
                  className="rounded-pill bg-brand-tint px-3.5 py-1.5 text-[13px] font-semibold text-brand no-underline hover:bg-brand hover:text-paper"
                >
                  {t.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}

/**
 * The skeleton lives INSIDE the page, not in loading.tsx: a loading
 * boundary in this segment (or above it) also wraps the nested
 * [slug]/section routes, and a flushed loading shell locks their
 * status at 200 before notFound() can say 404.
 */
export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton lang="ar" variant="home" />}>
      <HomeContent />
    </Suspense>
  );
}
