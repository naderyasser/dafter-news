import { Suspense } from "react";

import Link from "next/link";

import ArrowCarousel from "@/components/site/ArrowCarousel";
import ArticleCard from "@/components/site/ArticleCard";
import HeroSlider from "@/components/site/HeroSlider";
import LatestNewsTabs from "@/components/site/LatestNewsTabs";
import MostReadList from "@/components/site/MostReadList";
import OpinionCarousel from "@/components/site/OpinionCarousel";
import HeroCarouselBlock from "@/components/site/HeroCarouselBlock";
import LeadListBlock from "@/components/site/LeadListBlock";
import CompactListBlock from "@/components/site/CompactListBlock";
import SectionBlock from "@/components/site/SectionBlock";
import SportsBlock from "@/components/site/SportsBlock";
import SectionDivider from "@/components/site/SectionDivider";
import SectionHeading from "@/components/site/SectionHeading";
import SiteShell from "@/components/site/SiteShell";
import SpecialFilesBlock from "@/components/site/SpecialFilesBlock";
import VideoShowcase from "@/components/site/VideoShowcase";
import StoriesRail from "@/components/site/StoriesRail";
import WorldNewsBlock from "@/components/site/WorldNewsBlock";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { getArticles, getMatches, getSections, getStories, getTags, getVideos, mediaUrl, getMostRead, getLatest, getMostCommented, getSectionFeed } from "@/lib/api";
import { isArabicScript } from "@/lib/format";
import { sectionColor, sectionStyle } from "@/lib/sections";
import { sectionsItemListJsonLd } from "@/lib/seo";
import type { ArticleCard as ArticleCardType } from "@/lib/types";

// 30s: the ISR window is the ceiling on how fast «الأكثر قراءة» and the
// section blocks can visibly answer a publish or a burst of reads.
export const revalidate = 30;

/**
 * Sections this page lays out by hand, in the order they appear below. Every
 * other section is appended automatically by the tail loop, so adding one in
 * the dashboard puts it on the home page instead of stranding it on a
 * /section/… page no reader navigates to.
 */
const CURATED_KEYS = [
  "pol",
  "egypt",
  "gulf",
  "world",
  "economy",
  "art",
  "tech",
  "video",
  "sports",
  "opinion",
  "special",
  // «أمن ومحاكم» و«دليلك الأول» used to fall through to the tail loop and
  // render as the same plain card grid every other leftover section gets —
  // exactly the repeating-squares monotony the client asked to break. They
  // borrow «سياسة»'s and «شؤون مصر»'s own layouts below instead (no chip,
  // per the client's ask — see toSectionCard, which neither of these two
  // ever overrides to add one), so a reader scrolling past sees a shape
  // they've already seen elsewhere on the page rather than a new one.
  "security",
  "guide",
];

function toSectionCard(a: ArticleCardType) {
  return {
    href: `/article/${a.slug}`,
    title: a.title,
    section: a.section_name,
    badge: a.badge,
    // NO timestamp on a home-page card, deliberately — see the note above
    // HomeContent. The article page still stamps every story.
    imageSrc: mediaUrl(a.cover_image),
  };
}

// «سياسة» — the client's own reference: lead-photo-headline plus a two-up
// carousel, the red corner tag reading the subcategory («حرب إيران») and
// falling back to the section name so it's never blank, same rule
// toWorldCard already uses for the same «وسم أحمر» field.
function toHeroCarouselCard(a: ArticleCardType) {
  return {
    href: `/article/${a.slug}`,
    title: a.title,
    badge: a.badge,
    chip: a.subcategory || a.section_name,
    imageSrc: mediaUrl(a.cover_image),
  };
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
    imageSrc: mediaUrl(a.cover_image),
  };
}

/**
 * «الخليج العربي» carries the country, not the section name, everywhere a
 * label shows for it — both the floating chip on the photo and the
 * text-column kicker LeadListBlock's list rows print beside the headline.
 *
 * Overriding `section` too (not just adding `chip`) is the point: leaving it
 * at toSectionCard's default `a.section_name` still printed "الخليج العربي"
 * on every row regardless of the chip, which is exactly the client's report
 * — a story about Kuwait read no differently from one about Qatar. A story
 * with no country set shows no kicker at all rather than falling back to
 * the section name — silence reads truer than mislabeling it as a country.
 */
function toGulfCard(a: ArticleCardType) {
  return { ...toSectionCard(a), section: a.country || undefined, chip: a.country || undefined };
}

/** «ثقافة وفن» — the one field this section was missing entirely: the red
 *  corner tag every other photo-led block on the page carries, same
 *  subcategory-then-section fallback toHeroCarouselCard uses for «سياسة». */
function toArtCard(a: ArticleCardType) {
  return { ...toSectionCard(a), chip: a.subcategory || a.section_name };
}

/**
 * A section block is strictly newest-first.
 *
 * This used to lead with `-pinned`, so «الظهور في الرئيسية» pushed a story
 * to the top of its own section's block as well as the hero. The cost of
 * that showed up in «الخليج العربي»: six pinned Gulf stories, the newest of
 * them 22 hours old, sat above one published an hour ago — a live section
 * front that hadn't visibly moved in days, which is the reported bug.
 *
 * The flag still leads the hero (see heroPool below), which is what it is
 * for. A section block is a chronological feed; if a story deserves the top
 * of the page, that is the hero's job.
 */
const sectionFeed = (key: string, size = 6) => getSectionFeed("ar", key, size);

async function HomeContent() {
  const [pinnedRes, recent, politics, egypt, gulf, world, econ, sports, art, tech, special, security, guide, videos, opinion, mostRead, tags, popular, stories, matches, sections] =
    await Promise.all([
      getArticles("?language=ar&pinned=true&ordering=-published_at&page_size=5"),
      getLatest("ar", 12),
      sectionFeed("pol"),
      sectionFeed("egypt"),
      sectionFeed("gulf"),
      sectionFeed("world", 7),
      sectionFeed("economy"),
      sectionFeed("sports"),
      sectionFeed("art", 7),
      sectionFeed("tech"),
      sectionFeed("special", 8),
      sectionFeed("security"),
      sectionFeed("guide"),
      // Deeper than the four a grid needed: the showcase's thumbnail strip is
      // the section's navigation, and it only reads as a playlist with a
      // playlist's worth of tiles in it.
      getVideos("?page_size=12"),
      getArticles("?language=ar&kind=opinion&ordering=-published_at&page_size=6"),
      getMostRead("ar"),
      getTags(),
      getMostCommented("ar"),
      getStories(),
      getMatches(),
      getSections(),
    ]);

  // Symmetric with /en's isLatin filter: stories, videos and tags are
  // single-column fields that now hold BOTH languages in the seed, so each
  // edition takes only what is written in its own script — without this the
  // English rows would surface under Arabic headings here.
  const arStories = stories.results.filter((st) => isArabicScript(st.title));
  const arVideos = videos.results.filter((v) => isArabicScript(v.title));
  const arTags = tags.results.filter((t) => isArabicScript(t.name));

  // A curated block's masthead — cover photo + tagline — is set per section
  // in the dashboard, not hardcoded here. Undefined for a section with
  // neither, which is what makes each block fall back to its plain heading.
  const masthead = (key: string) => {
    const s = sections.results.find((sec) => sec.key === key);
    return { coverImage: mediaUrl(s?.cover_image ?? null), tagline: s?.tagline || undefined };
  };

  // The tail: every section without a bespoke block above. Empty ones are
  // dropped rather than rendered as a bare heading.
  const tailSections = sections.results.filter((s) => !CURATED_KEYS.includes(s.key));
  const tailFeeds = await Promise.all(tailSections.map((s) => sectionFeed(s.key, 4)));
  const tail = tailSections
    .map((section, i) => ({ section, articles: tailFeeds[i].results }))
    .filter(({ articles }) => articles.length);


  // The hero rotates the top stories — pinned first («تثبيت في الرئيسية»
  // from the editor), the latest filling whatever slots remain. The side
  // rail carries what isn't in it.
  const pinnedIds = new Set(pinnedRes.results.map((a) => a.id));
  const heroPool = [...pinnedRes.results, ...recent.results.filter((a) => !pinnedIds.has(a.id))].slice(0, 5);
  const heroSlides = heroPool.map((a) => ({
    href: `/article/${a.slug}`,
    title: a.title,
    section: a.section_name,
    badge: a.badge,
    imageSrc: mediaUrl(a.cover_image),
  }));
  const heroIds = new Set(heroPool.map((a) => a.id));
  const heroSide = recent.results.filter((a) => !heroIds.has(a.id)).slice(0, 4);

  /**
   * Page-level "already shown" set, for the CROSS-SECTION blocks only.
   *
   * The distinction matters and was got wrong once already. There are two
   * kinds of block on this page:
   *
   *  - Aggregate blocks (the hero, its side rail, «آخر الأخبار», the tail)
   *    draw from the whole paper. Two of them showing the same story is
   *    pure repetition, so they filter through `claim`.
   *
   *  - A SECTION block is that desk's own feed. Its job is to answer "what
   *    is newest in سياسة", and the honest answer does not change because
   *    the hero happens to be running the same story. These use `mark`.
   *
   * Filtering section blocks was a real, reported bug: a freshly published
   * story is by definition the newest thing on the site, so the hero took it
   * first and its own section silently dropped it. The editor published to
   * سياسة, could not find it in سياسة, and reasonably concluded the page was
   * serving stale cache. It was not — the story was on the page, in the
   * hero, and deliberately withheld from the one block being checked.
   *
   * Section blocks still MARK what they show, so the aggregate blocks below
   * them («آخر الأخبار», the tail) do not repeat it a third time.
   *
   * The breaking ticker is exempt from both (a story can be the lead and
   * breaking at once); it dedupes within its own loop.
   */
  const seenIds = new Set<number>([...heroIds, ...heroSide.map((a) => a.id)]);
  /** Filter out anything already shown, then mark what survives. */
  const claim = <T extends { id: number }>(items: T[], limit?: number): T[] => {
    const kept = items.filter((a) => !seenIds.has(a.id));
    const out = typeof limit === "number" ? kept.slice(0, limit) : kept;
    out.forEach((a) => seenIds.add(a.id));
    return out;
  };
  /** Show everything, but record it so later aggregate blocks skip it. */
  const mark = <T extends { id: number }>(items: T[]): T[] => {
    items.forEach((a) => seenIds.add(a.id));
    return items;
  };

  // Section blocks: their own newest, unfiltered — see `mark` above.
  const politicsCards = mark(politics.results);
  const egyptCards = mark(egypt.results);
  const worldCards = mark(world.results);
  const gulfCards = mark(gulf.results);
  const econCards = mark(econ.results);
  const sportsCards = mark(sports.results);
  const artCards = mark(art.results);
  const guideCards = mark(guide.results);
  const techCards = mark(tech.results);
  const securityCards = mark(security.results);
  const specialCards = mark(special.results);
  // The tail renders last, so it claims last — and a tail section left with
  // nothing after dedup is dropped entirely rather than rendered as a bare
  // heading over an empty grid.
  const tailBlocks = tail
    .map(({ section, articles }) => ({ section, articles: claim(articles) }))
    .filter(({ articles }) => articles.length);

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
  }));

  const specialItems = specialCards.map((a) => ({
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
    avatar: mediaUrl(a.author_avatar),
  }));

  // Claimed last, matching where «آخر الأخبار» actually renders (foot of the
  // page): it fills with whatever the sections above did not already take,
  // rather than repeating the hero back to a reader who has just scrolled
  // the whole page past it.
  const newsLatest = claim(recent.results, 6).map((a) => ({
    href: `/article/${a.slug}`,
    title: a.title,
  }));
  // Built once: the list renders beside the hero now, not at the foot of the
  // page. Deliberately NOT run through `claim` — a most-read ranking that
  // silently dropped whichever stories happened to lead the page would stop
  // being a ranking at all.
  const mostReadItems = mostRead.results.map((a) => ({
    title: a.title,
    href: `/article/${a.slug}`,
    section: a.section_name,
    views: a.views,
    imageSrc: mediaUrl(a.cover_image),
  }));

  const newsPopular = popular.results.map((a) => ({
    href: `/article/${a.slug}`,
    title: a.title,
    // «٠ تعليق» under a story in the "most discussed" tab states the exact
    // opposite of what the tab claims — omitted rather than printed.
    time: a.comment_count ? `${a.comment_count} تعليق` : undefined,
  }));

  return (
    <SiteShell lang="ar" active="home">
      {/* The WebSite/publisher graph that used to sit here now ships from
          the root layout (app/layout.tsx), so it is on every page rather
          than this one alone — emitting it here too would just repeat the
          same two nodes on the homepage. */}
      {/* Documents the site's main sections for a crawler — the technical
          floor sitelinks are decided from, not a switch that turns them on
          (see lib/seo.ts's sectionsItemListJsonLd for why). */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: sectionsItemListJsonLd(sections.results) }} />
      <StoriesRail lang="ar" stories={arStories} />

      <div className="mx-auto flex max-w-container flex-wrap gap-8 px-6 pb-8 pt-5">
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
                badge={a.badge}
                imageSrc={mediaUrl(a.cover_image)}
              />
            </div>
          ))}

          {/* «الأكثر قراءة» sat at the very bottom of the page, past every
              section — a ranking nobody scrolled far enough to read. Beside
              the hero it is inside the first screen, which is where a
              most-read list is actually useful for navigation. */}
          <div className="mt-5 border-t border-line pt-5">
            <MostReadList lang="ar" items={mostReadItems} />
          </div>
        </div>
      </div>

      <SectionDivider />

      {/* SECTION ORDER — the client's own hierarchy, top to bottom:
          سياسة ← شؤون مصر ← عرب وعالم ← الخليج، ثم البقية.

          The desks with the fewest editors sit at the bottom on purpose: a
          thin section low on the page reads as depth, the same section high
          on the page reads as a gap.

          Adjacent sections never share a layout variant — the client asked
          for varied designs, not one grid repeated. Reading down:
          HeroCarousel → LeadList → World → LeadList → grid → Sports →
          V4 media → carousel → V3 list → carousel → V3 list → shelf →
          opinion. `claim()` above is called in this same order, so dedup
          priority follows the page. */}

      {/* 1. سياسة — صورة قائد بعنوان فوقها، ثم شريط بطاقتين بأسهم ونقاط. */}
      {politicsCards.length ? (
        <>
          <HeroCarouselBlock
            lang="ar"
            title="سياسة"
            href="/section/pol"
            sectionKey="pol"
            cards={politicsCards.map(toHeroCarouselCard)}
          />
          <SectionDivider />
        </>
      ) : null}

      {/* 2. شؤون مصر — lead photo + white list. */}
      <LeadListBlock
        lang="ar"
        title="شؤون مصر"
        seeAllHref="/section/egypt"
        sectionKey="egypt"
        cards={egyptCards.map(toSectionCard)}
        {...masthead("egypt")}
      />
      {egyptCards.length ? <SectionDivider /> : null}

      {/* 3. عرب وعالم — its own front-page treatment (lead + rail + tiles,
          country chips on the photos), deliberately not shared with any
          other section: the client asked for this design to be its alone. */}
      <WorldNewsBlock lang="ar" title="عرب وعالم" href="/section/world" cards={worldCards.map(toWorldCard)} sectionKey="world" />
      {worldCards.length ? <SectionDivider /> : null}

      {/* 4. الخليج العربي — same lead-photo-plus-list shape as شؤون مصر, on
          the client's explicit request that the two share one design. Not
          adjacent to it, so the repeat never reads as a repeat. */}
      {gulfCards.length ? (
        <>
          <LeadListBlock
            lang="ar"
            title="الخليج العربي"
            seeAllHref="/section/gulf"
            sectionKey="gulf"
            cards={gulfCards.map(toGulfCard)}
            {...masthead("gulf")}
          />
          <SectionDivider />
        </>
      ) : null}

      {/* ---- البقية، والأقل تحديثاً في الأسفل ---- */}

      {/* حركة السوق — V2 equal grid. */}
      <SectionBlock lang="ar" title="حركة السوق" seeAllHref="/section/economy" cards={econCards.map(toSectionCard)} initialCount={4} sectionKey="economy" />
      {econCards.length ? <SectionDivider /> : null}

      {/* جوّه الجون — its own floodlit surface rather than a fourth grid. */}
      <SportsBlock lang="ar" title="جوّه الجون" href="/section/sports" cards={sportsCards.map(toSectionCard)} matches={matches.results} />

      {/* لقطة وتعليق — V4 media strip. No divider after: the navy band's own
          bottom edge separates it from what follows. */}
      <VideoShowcase lang="ar" title="لقطة وتعليق" href="/video" videos={showcaseVideos} />

      {/* ثقافة وفن — photo-first arrow rail. */}
      {artCards.length ? (
        <>
          <section className="section-watermark mx-auto max-w-container px-6 py-8" style={sectionStyle("art")}>
            <SectionHeading lang="ar" title="ثقافة وفن" href="/section/art" sectionKey="art" />
            <ArrowCarousel lang="ar" itemClassName="w-[480px] max-w-[88vw]" overlayArrows>
              {artCards.map((a) => (
                <ArticleCard key={a.id} lang="ar" variant="hero" {...toArtCard(a)} accent={sectionColor("art")} />
              ))}
            </ArrowCarousel>
          </section>
          <SectionDivider />
        </>
      ) : null}

      {/* دليلك الأول — V3 headline list. Service journalism needs breadth,
          not photographs. */}
      {guideCards.length ? (
        <>
          <CompactListBlock lang="ar" title="دليلك الأول" href="/section/guide" sectionKey="guide" cards={guideCards} showTime={false} />
          <SectionDivider />
        </>
      ) : null}

      {/* علوم وتكنولوجيا — arrow rail (the عكاظ pattern). Sits between the
          two V3 lists so neither pair of like layouts is adjacent. */}
      {techCards.length ? (
        <>
          <section className="section-watermark mx-auto max-w-container px-6 py-8" style={sectionStyle("tech")}>
            <SectionHeading lang="ar" title="علوم وتكنولوجيا" href="/section/tech" sectionKey="tech" />
            <ArrowCarousel lang="ar" itemClassName="w-[300px]">
              {techCards.map((a) => (
                <ArticleCard key={a.id} lang="ar" variant="standard" {...toSectionCard(a)} accent={sectionColor("tech")} />
              ))}
            </ArrowCarousel>
          </section>
          <SectionDivider />
        </>
      ) : null}

      {/* أمن ومحاكم — V3 headline list. */}
      {securityCards.length ? (
        <>
          <CompactListBlock lang="ar" title="أمن ومحاكم" href="/section/security" sectionKey="security" cards={securityCards} showTime={false} />
          <SectionDivider />
        </>
      ) : null}

      {/* ملف خاص — the magazine shelf. Its own dark band is the separation. */}
      <SpecialFilesBlock lang="ar" title="ملف خاص" href="/section/special" items={specialItems} />

      {/* Anything added in the dashboard later that isn't curated above —
          rendered here rather than left to /section/… pages. */}
      {tailBlocks.map(({ section, articles }) => (
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
        {/* «الأكثر قراءة» used to be repeated here as well; it now lives
            beside the hero (see above) and this rail keeps the tag cloud. */}
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
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
