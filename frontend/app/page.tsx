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
import ReelsRail from "@/components/site/ReelsRail";
import VideoShowcase from "@/components/site/VideoShowcase";
import StoriesRail from "@/components/site/StoriesRail";
import WorldNewsBlock from "@/components/site/WorldNewsBlock";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { getArticles, getMatches, getSections, getStories, getTags, getVideos, mediaUrl, getMostRead, getLatest, getMostCommented, getReels, getSectionFeed, getSiteSettings } from "@/lib/api";
import { isArabicScript } from "@/lib/format";
import { REELS_HIDDEN, VIDEO_DESK_HIDDEN, visibleSections } from "@/lib/hiddenDesks";
import { pickLatest } from "@/lib/homeFeed";
import { articleHref } from "@/lib/routes";
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
    href: articleHref(a),
    title: a.title,
    section: a.section_name,
    badge: a.badge,
    // NO timestamp on a home-page card, deliberately — see the note above
    // HomeContent. The article page still stamps every story.
    imageSrc: mediaUrl(a.cover_image),
    kind: a.kind,
    authorAvatar: mediaUrl(a.author_avatar),
  };
}

// «سياسة» — the client's own reference: lead-photo-headline plus a two-up
// carousel, the red corner tag reading the subcategory («حرب إيران») and
// falling back to the section name so it's never blank, same rule
// toWorldCard already uses for the same «وسم أحمر» field.
function toHeroCarouselCard(a: ArticleCardType) {
  return {
    href: articleHref(a),
    title: a.title,
    badge: a.badge,
    chip: a.subcategory || a.section_name,
    imageSrc: mediaUrl(a.cover_image),
  };
}

function toWorldCard(a: ArticleCardType) {
  return {
    href: articleHref(a),
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
/** The client's standard: every category block on the home page shows
 *  exactly this many stories, with «المزيد» at its foot for the rest. */
const BLOCK_SIZE = 5;

const sectionFeed = (key: string, size = BLOCK_SIZE) => getSectionFeed("ar", key, size);

/**
 * A photo-led block needs enough stories to look like a block.
 *
 * With one story, «شؤون مصر»'s lead-plus-list shape degrades to a single
 * large photograph with a headline under it and nothing else — which is
 * exactly the "broken/ugly layout" the newsroom reported on the quieter
 * desks. Below this threshold a section falls back to the plain headline
 * list, which reads as a deliberate compact block at any length.
 */
const MIN_FOR_PHOTO_LED = 2;

async function HomeContent() {
  const [pinnedRes, recent, politics, egypt, gulf, world, econ, sports, art, tech, special, security, guide, videos, opinion, mostRead, tags, popular, stories, matches, sections, reels, settings] =
    await Promise.all([
      getArticles("?language=ar&pinned=true&ordering=-published_at&page_size=5"),
      getLatest("ar", 12),
      sectionFeed("pol"),
      sectionFeed("egypt"),
      sectionFeed("gulf"),
      sectionFeed("world"),
      sectionFeed("economy"),
      sectionFeed("sports"),
      sectionFeed("art"),
      sectionFeed("tech"),
      sectionFeed("special"),
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
      // «حصل إيه؟» — the Facebook shorts shelf that now holds the media slot
      // on this page. Settings comes along for the paper's own page URL, which
      // is the rail's footer link; it is the same cached read SiteFooter
      // already makes, so it costs nothing extra.
      getReels(),
      getSiteSettings(),
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
  const tailSections = visibleSections(sections.results).filter((s) => !CURATED_KEYS.includes(s.key));
  const tailFeeds = await Promise.all(tailSections.map((s) => sectionFeed(s.key, BLOCK_SIZE)));
  const tail = tailSections
    .map((section, i) => ({ section, articles: tailFeeds[i].results }))
    .filter(({ articles }) => articles.length);


  // The hero rotates the top stories — pinned first («تثبيت في الرئيسية»
  // from the editor), the latest filling whatever slots remain. The side
  // rail carries what isn't in it.
  const pinnedIds = new Set(pinnedRes.results.map((a) => a.id));
  const heroPool = [...pinnedRes.results, ...recent.results.filter((a) => !pinnedIds.has(a.id))].slice(0, 5);
  const heroSlides = heroPool.map((a) => ({
    href: articleHref(a),
    title: a.title,
    section: a.section_name,
    badge: a.badge,
    imageSrc: mediaUrl(a.cover_image),
  }));
  const heroIds = new Set(heroPool.map((a) => a.id));
  const heroSide = recent.results.filter((a) => !heroIds.has(a.id)).slice(0, 4);

  /**
   * Page-level "already shown" set.
   *
   * The hero and its side rail are the only blocks that filter against it,
   * and they do it between themselves: the side rail takes what the hero did
   * not. Everything below simply RECORDS what it shows.
   *
   * The reason is that every other block on this page has a fixed job — this
   * desk's newest, the latest news, the most read — and a block with a fixed
   * job cannot be allowed to come back empty. Two rounds of filtering proved
   * that twice over, and both were reported as bugs by the newsroom.
   *
   * Filtering section blocks was the first: a freshly published
   * story is by definition the newest thing on the site, so the hero took it
   * first and its own section silently dropped it. The editor published to
   * سياسة, could not find it in سياسة, and reasonably concluded the page was
   * serving stale cache. It was not — the story was on the page, in the
   * hero, and deliberately withheld from the one block being checked.
   *
   * Section blocks still MARK what they show, so anything downstream can ask
   * "has this been shown?" without a second pass over the page.
   *
   * There is deliberately no `claim` helper any more. Filtering a block
   * against this set starved two of them in turn — first the section blocks,
   * then «أحدث الأخبار», which rendered an empty box under its own heading
   * once the sections began marking. Every block on this page has a fixed
   * job (this desk's newest, the latest news, the most read); none of them
   * is improved by being allowed to come back empty. Repetition far down a
   * long page is a much smaller cost than a heading over nothing.
   *
   * The breaking ticker is exempt as well (a story can be the lead and
   * breaking at once); it dedupes within its own loop.
   */
  const seenIds = new Set<number>([...heroIds, ...heroSide.map((a) => a.id)]);
  /** Show everything, but record it so any later block can skip it. */
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
  // A tail section is still a section block: it answers "what is newest in
  // this desk", so it marks rather than filters, exactly like the curated
  // ones above. Filtering it could empty a quiet desk entirely and drop the
  // whole block — the same failure the section blocks themselves had.
  const tailBlocks = tail
    .map(({ section, articles }) => ({ section, articles: mark(articles) }))
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
    href: articleHref(a),
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
  /**
   * «أحدث الأخبار» — the latest, always non-empty.
   *
   * This is NOT run through `claim`. Once section blocks began marking every
   * story they show (so the desks stop losing their own newest), the marked
   * set covers most of `recent` — and a `claim` here returned nothing at
   * all, leaving the tab rendering an empty box under its own heading.
   *
   * Instead it skips only what the TOP of the page is already showing (the
   * hero and its side rail, which a reader has just scrolled past), and then
   * tops up from the full list so a busy day can never empty it. A tab
   * labelled "latest news" showing nothing is worse than one repeating a
   * story from the top of a long page.
   */
  const topOfPage = new Set<number>([...heroIds, ...heroSide.map((a) => a.id)]);
  const newsLatest = pickLatest(recent.results, topOfPage, 6).map((a) => ({
    href: articleHref(a),
    title: a.title,
  }));
  // Built once: the list renders beside the hero now, not at the foot of the
  // page. Deliberately NOT run through `claim` — a most-read ranking that
  // silently dropped whichever stories happened to lead the page would stop
  // being a ranking at all.
  const mostReadItems = mostRead.results.map((a) => ({
    title: a.title,
    href: articleHref(a),
    section: a.section_name,
    views: a.views,
    imageSrc: mediaUrl(a.cover_image),
    kind: a.kind,
    authorAvatar: mediaUrl(a.author_avatar),
  }));

  const reelCards = reels.results.map((r) => ({
    id: r.id,
    title: r.title,
    thumbnail: mediaUrl(r.thumbnail),
    href: `/reel/${r.slug}`,
  }));

  /** The paper's own Facebook page, from Settings → روابط التواصل. Undefined
   *  when it isn't set, which hides the rail's footer link rather than
   *  shipping one that goes nowhere. */
  const facebookPage =
    settings?.social_links?.find((l) => l.platform === "facebook" && l.url)?.url || undefined;

  const newsPopular = popular.results.map((a) => ({
    href: articleHref(a),
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
          (see lib/seo.ts's sectionsItemListJsonLd for why). A hidden desk is
          left out of it — this graph is a list of URLs handed to Google, and
          a hidden desk's front answers 404. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: sectionsItemListJsonLd(visibleSections(sections.results)) }} />
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
                href={articleHref(a)}
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

      {/* SECTION ORDER — the client's own hierarchy, top to bottom:
          سياسة ← شؤون مصر ← عرب وعالم ← الخليج، ثم البقية.

          The desks with the fewest editors sit at the bottom on purpose: a
          thin section low on the page reads as depth, the same section high
          on the page reads as a gap.

          Adjacent sections never share a layout variant — the client asked
          for varied designs, not one grid repeated. Reading down:
          HeroCarousel → LeadList → World → LeadList → grid → Sports →
          V4 media → carousel → V3 list → carousel → V3 list → shelf →
          opinion. */}

      {/* 1. سياسة — صورة قائد بعنوان فوقها، ثم شريط بطاقتين بأسهم ونقاط. */}
      {politicsCards.length ? (
        <>
          {politicsCards.length < MIN_FOR_PHOTO_LED ? (
            <CompactListBlock lang="ar" title="سياسة" href="/section/pol" sectionKey="pol" cards={politicsCards} showTime={false} />
          ) : (
          <HeroCarouselBlock
            lang="ar"
            title="سياسة"
            href="/section/pol"
            sectionKey="pol"
            cards={politicsCards.map(toHeroCarouselCard)}
          />
          )}
          <SectionDivider />
        </>
      ) : null}

      {/* «حصل إيه؟» — right after «سياسة», ahead of every other curated desk:
          the client's own placement call. Light-themed (see ReelsRail's own
          docstring), so it takes the standard SectionDivider on both sides
          like any other light block, unlike its old dark-band position
          lower on the page which separated itself with its own edge. */}
      {!REELS_HIDDEN && reelCards.length ? (
        <>
          <ReelsRail lang="ar" reels={reelCards} facebookUrl={facebookPage} />
          <SectionDivider />
        </>
      ) : null}

      {/* 2. شؤون مصر — lead photo + white list, or the plain list on a quiet
          day (see MIN_FOR_PHOTO_LED). */}
      {egyptCards.length >= MIN_FOR_PHOTO_LED ? (
        <LeadListBlock
          lang="ar"
          title="شؤون مصر"
          seeAllHref="/section/egypt"
          sectionKey="egypt"
          cards={egyptCards.map(toSectionCard)}
          {...masthead("egypt")}
        />
      ) : (
        <CompactListBlock lang="ar" title="شؤون مصر" href="/section/egypt" sectionKey="egypt" cards={egyptCards} showTime={false} />
      )}
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
          {gulfCards.length >= MIN_FOR_PHOTO_LED ? (
            <LeadListBlock
              lang="ar"
              title="الخليج العربي"
              seeAllHref="/section/gulf"
              sectionKey="gulf"
              cards={gulfCards.map(toGulfCard)}
              {...masthead("gulf")}
            />
          ) : (
            <CompactListBlock lang="ar" title="الخليج العربي" href="/section/gulf" sectionKey="gulf" cards={gulfCards} showTime={false} />
          )}
          <SectionDivider />
        </>
      ) : null}

      {/* ---- البقية، والأقل تحديثاً في الأسفل ---- */}

      {/* حركة السوق — V2 equal grid. */}
      <SectionBlock lang="ar" title="حركة السوق" seeAllHref="/section/economy" cards={econCards.map(toSectionCard)} initialCount={BLOCK_SIZE} sectionKey="economy" />
      {econCards.length ? <SectionDivider /> : null}

      {/* جوّه الجون — its own floodlit surface rather than a fourth grid. */}
      <SportsBlock lang="ar" title="جوّه الجون" href="/section/sports" cards={sportsCards.map(toSectionCard)} matches={matches.results} />

      {/* لقطة وتعليق — the media slot «بالمختصر» used to double up in here,
          before it moved to right after «سياسة» (see above). This is now a
          plain fallback for the one day reelCards is somehow empty AND
          there's nothing to fill the slot with otherwise — reelCards being
          empty no longer removes a section from the page the way it used to,
          since the reels shelf isn't homed in this slot any more; this is
          just «لقطة وتعليق» running normally in its own spot. */}
      {!VIDEO_DESK_HIDDEN && <VideoShowcase lang="ar" title="لقطة وتعليق" href="/video" videos={showcaseVideos} />}

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
            initialCount={BLOCK_SIZE}
            sectionKey={section.key}
          />
        </div>
      ))}

      <OpinionCarousel lang="ar" items={opinionItems} seeAllHref="/opinion" />

      <div className="mx-auto flex max-w-container flex-wrap items-start gap-8 px-6 py-8">
        <LatestNewsTabs lang="ar" latest={newsLatest} popular={newsPopular} />
        {/* «الأكثر قراءة» belongs down here beside «أحدث الأخبار», not at the
            top of the page. It briefly led the home page and the newsroom
            was right to send it back: no news front opens on a popularity
            ranking — a reader arrives for what is new, and what is most read
            is what they browse once the news itself is spent. */}
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
          <MostReadList lang="ar" items={mostReadItems} />
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
