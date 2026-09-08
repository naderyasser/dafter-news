import { notFound } from "next/navigation";

import MostReadList from "@/components/site/MostReadList";
import SectionFrontBody from "@/components/site/fronts/SectionFrontBody";
import type { FrontStory } from "@/components/site/fronts/types";
import SiteShell from "@/components/site/SiteShell";
import { getArticles, getMatches, getMostRead, getSection, getSectionFeed, getSectionMostRead, getTicker, getVideos, mediaUrl } from "@/lib/api";
import { isHiddenSection } from "@/lib/hiddenDesks";
import { standfirstFor } from "@/lib/format";
import { articleHref } from "@/lib/routes";
import { sectionColor } from "@/lib/sections";
import { sectionFront, sectionTagline } from "@/lib/sectionLayout";
import { pickMostReadRail } from "@/lib/sectionRail";
import { sectionMetadata } from "@/lib/seo";

export const revalidate = 60;

/**
 * Every section front rendered under the homepage's own title before this
 * — سياسة, رياضة, اقتصاد all read as the exact same page to Google. Beyond
 * the duplicate-title problem on its own, a search engine reads distinct,
 * clearly-titled section pages as the site structure sitelinks get decided
 * from (see lib/seo.ts's sectionMetadata/sectionsItemListJsonLd).
 */
export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  const _params = await params;
  if (isHiddenSection(_params.key)) return {};
  const section = await getSection(_params.key);
  if (!section) return {};
  return sectionMetadata(section, "ar");
}

/**
 * One section page.
 *
 * What lives here is everything that is not layout: fetching, the 404, the
 * «الأكثر قراءة» rail, and the single mapping from API rows to FrontStory.
 * SectionFrontBody picks the front (one grid for every article desk since
 * 2026-09-09 — see NewsGridFront) and a front receives a list and renders
 * it, so a renamed API field is one edit and a desk can be moved onto a
 * different front from lib/sectionLayout.ts without this file changing.
 */
export default async function SectionPage({ params }: { params: Promise<{ key: string }> }) {
  const _params = await params;
  const front = sectionFront(_params.key);

  const [section, articles, deskMostRead, siteMostRead, latest, matches, ticker, videos] = await Promise.all([
    getSection(_params.key),
    // Strictly newest-first. This led with `-pinned` and so did the home
    // page's blocks, which is how «الخليج العربي» came to show a 22-hour-old
    // story above one published an hour before — see app/page.tsx's
    // sectionFeed. «الظهور في الرئيسية» still leads the hero.
    getSectionFeed("ar", _params.key, 24),
    // The desk's own most-read, with the site-wide list behind it for a
    // quiet week — see lib/sectionRail.
    front.aside ? getSectionMostRead("ar", _params.key) : Promise.resolve(null),
    front.aside ? getMostRead("ar") : Promise.resolve(null),
    getArticles("?language=ar&ordering=-published_at&page_size=12"),
    front.feed === "matches" ? getMatches() : Promise.resolve(null),
    front.feed === "markets" ? getTicker() : Promise.resolve(null),
    front.feed === "videos" ? getVideos("?page_size=24") : Promise.resolve(null),
  ]);

  // A desk taken off the public site has no front — see lib/hiddenDesks.ts.
  if (!section || isHiddenSection(_params.key)) notFound();

  const accent = sectionColor(_params.key);
  // CTR ask: a relative-time caption on a browsing card discourages a click
  // when the story doesn't look brand-new, so no front-facing card carries
  // one — the article's own byline is still where a reader reads the real
  // published time.
  const stories: FrontStory[] = articles.results.map((a) => ({
    id: a.id,
    href: articleHref(a),
    title: a.title,
    // Deduplicated once, here: almost every story in the database carries a
    // standfirst identical to its headline, and a front that printed both
    // printed the same sentence twice on every card.
    standfirst: standfirstFor(a.title, a.standfirst),
    imageSrc: mediaUrl(a.cover_image),
    time: "",
    iso: null,
    badge: a.badge,
    views: a.views,
    country: a.country || undefined,
    subject: a.subcategory || undefined,
    authorName: a.author_name || undefined,
    authorAvatar: mediaUrl(a.author_avatar),
    authorInitial: a.author_initial || undefined,
    comments: a.comment_count,
  }));

  // The rest of the paper, for a desk having a quiet week. Anything this
  // section already shows is filtered out so the rail never repeats a story
  // the reader just scrolled past.
  const ownHrefs = new Set(stories.map((s) => s.href));
  const more: FrontStory[] = latest.results
    .map((a) => ({
      id: a.id,
      href: articleHref(a),
      title: a.title,
      imageSrc: mediaUrl(a.cover_image),
      time: "",
      badge: a.badge,
      views: a.views,
      section: a.section_name,
    }))
    .filter((s) => !ownHrefs.has(s.href))
    .slice(0, 6);

  // Rendered twice, once per breakpoint: inside the front between the card
  // grid and the rows on a phone (where the aside would land under two
  // dozen stories), and as the sidebar from `lg` up. Five rows, so the
  // duplicate costs nothing worth measuring.
  const rail = pickMostReadRail(deskMostRead?.results ?? [], siteMostRead?.results ?? []);
  const railNode =
    front.aside && rail.items.length > 0 ? (
      <MostReadList
        lang="ar"
        heading={rail.scoped ? `الأكثر قراءة في ${section.name_ar}` : undefined}
        items={rail.items.map((a) => ({
          title: a.title,
          href: articleHref(a),
          section: a.section_name,
          views: a.views,
          imageSrc: mediaUrl(a.cover_image),
          kind: a.kind,
          authorAvatar: mediaUrl(a.author_avatar),
        }))}
      />
    ) : null;

  return (
    <SiteShell lang="ar" active={_params.key}>
      <div className="mx-auto flex max-w-container flex-wrap items-start gap-10 px-6 py-8">
        <main className="min-w-0 flex-[2_1_560px]">
          <SectionFrontBody
            front={front.front}
            feeds={{ matches, ticker, videos }}
            more={more}
            between={railNode}
            lang="ar"
            accent={accent}
            sectionKey={_params.key}
            title={section.name_ar}
            tagline={sectionTagline(_params.key, "ar")}
            stories={stories}
          />
        </main>
        {/* `--rule-b` is the second tone of the two-colour heading rule (see
            globals.css). Setting it on the aside is what keeps the rail beside
            a green sports page green and beside an oxblood politics page
            oxblood, instead of every sidebar reverting to the default blue. */}
        {/* A plain wrapper, not an <aside>: MostReadList is itself the
            <aside> landmark, and nesting one inside another gives a screen
            reader two complementary regions where the page has one. */}
        {railNode && (
          <div
            className="hidden min-w-[260px] max-w-[320px] flex-[1_1_280px] lg:block"
            style={{ "--rule-b": accent } as React.CSSProperties}
          >
            {railNode}
          </div>
        )}
      </div>
    </SiteShell>
  );
}
