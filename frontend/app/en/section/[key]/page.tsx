import { notFound } from "next/navigation";

import MostReadList from "@/components/site/MostReadList";
import SectionFrontBody from "@/components/site/fronts/SectionFrontBody";
import type { FrontStory } from "@/components/site/fronts/types";
import SiteShell from "@/components/site/SiteShell";
import { getArticles, getMatches, getSection, getTicker, getVideos, mediaUrl, getMostRead, getSectionFeed } from "@/lib/api";
import { standfirstFor } from "@/lib/format";
import { sectionColor } from "@/lib/sections";
import { sectionFront, sectionTagline } from "@/lib/sectionLayout";
import { sectionMetadata } from "@/lib/seo";

export const revalidate = 60;

/** See app/section/[key]/page.tsx's own generateMetadata for why. */
export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  const _params = await params;
  const section = await getSection(_params.key);
  if (!section) return {};
  return sectionMetadata(section, "en");
}

/**
 * English counterpart of /section/[key] — same front, same device, so
 * switching language never changes what a section IS.
 *
 * The two pages differ only in which language's articles they ask for and
 * where their links point. The layout switch itself lives in SectionFrontBody
 * precisely so it cannot drift between the two editions, which it did while
 * each page carried its own copy.
 */
export default async function SectionEnPage({ params }: { params: Promise<{ key: string }> }) {
  const _params = await params;
  const front = sectionFront(_params.key);

  const [section, articles, mostRead, latest, matches, ticker, videos] = await Promise.all([
    getSection(_params.key),
    // Newest-first — mirrors the Arabic section page; see its own comment.
    getSectionFeed("en", _params.key, 24),
    getMostRead("en"),
    getArticles("?language=en&ordering=-published_at&page_size=12"),
    front.feed === "matches" ? getMatches() : Promise.resolve(null),
    front.feed === "markets" ? getTicker() : Promise.resolve(null),
    front.feed === "videos" ? getVideos("?page_size=24") : Promise.resolve(null),
  ]);

  if (!section) notFound();

  const accent = sectionColor(_params.key);
  // CTR ask: no relative-time caption on a browsing card — see the Arabic
  // section page's own comment for the full reasoning. `iso` stays wired
  // for Politics/Security only, where it drives the front's own dated
  // spine/register rather than a decorative timestamp.
  const keepDateStructure = front.front === "politics" || front.front === "security";
  const stories: FrontStory[] = articles.results.map((a) => ({
    id: a.id,
    href: `/en/article/${a.slug}`,
    title: a.title,
    standfirst: standfirstFor(a.title, a.standfirst),
    imageSrc: mediaUrl(a.cover_image),
    time: "",
    iso: keepDateStructure ? a.published_at : null,
    badge: a.badge,
    views: a.views,
    country: a.country || undefined,
    subject: a.subcategory || undefined,
    authorName: a.author_name_en || a.author_name || undefined,
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
      href: `/en/article/${a.slug}`,
      title: a.title,
      imageSrc: mediaUrl(a.cover_image),
      time: "",
      badge: a.badge,
      views: a.views,
      section: a.section_name,
    }))
    .filter((s) => !ownHrefs.has(s.href))
    .slice(0, 6);

  return (
    <SiteShell lang="en" active={_params.key}>
      <div className="mx-auto flex max-w-container flex-wrap items-start gap-10 px-6 py-8">
        <main className="min-w-0 flex-[2_1_560px]">
          <SectionFrontBody
            front={front.front}
            feeds={{ matches, ticker, videos }}
            count={articles.count}
            more={more}
            lang="en"
            accent={accent}
            sectionKey={_params.key}
            title={section.name_en || section.name_ar}
            tagline={sectionTagline(_params.key, "en")}
            stories={stories}
          />
        </main>
        {front.aside && (
          <aside
            className="min-w-[260px] max-w-[320px] flex-[1_1_280px]"
            style={{ "--rule-b": accent } as React.CSSProperties}
          >
            <MostReadList
              lang="en"
              items={mostRead.results.map((a) => ({
                title: a.title,
                href: `/en/article/${a.slug}`,
                section: a.section_name,
                views: a.views,
                imageSrc: mediaUrl(a.cover_image),
              }))}
            />
          </aside>
        )}
      </div>
    </SiteShell>
  );
}
