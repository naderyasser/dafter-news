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
import StoriesRail from "@/components/site/StoriesRail";
import WorldNewsBlock from "@/components/site/WorldNewsBlock";
import { getArticles, getMatches, getSections, getStories, getTags, getVideos, mediaUrl } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import type { ArticleCard as ArticleCardType, Badge } from "@/lib/types";

export const revalidate = 60;

/**
 * Sections this page lays out by hand, in the order they appear below. Every
 * other section is appended automatically by the tail loop, so adding one in
 * the dashboard puts it on the home page instead of stranding it on a
 * /section/… page no reader navigates to.
 */
const CURATED_KEYS = ["egypt", "gulf", "world", "economy", "art", "tech", "video", "sports", "opinion"];

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

function toWorldCard(a: ArticleCardType) {
  return {
    href: `/article/${a.slug}`,
    title: a.title,
    // Falls back to the section name when an editor hasn't set a subcategory,
    // so the red chip is never blank.
    label: a.subcategory || a.section_name,
    time: relativeTime(a.published_at, "ar"),
    imageSrc: mediaUrl(a.cover_image),
  };
}

const sectionFeed = (key: string, size = 6) =>
  getArticles(`?language=ar&section__key=${key}&ordering=-published_at&page_size=${size}`);

export default async function HomePage() {
  const [recent, egypt, gulf, world, econ, sports, art, tech, videos, opinion, mostRead, tags, popular, stories, matches, sections] =
    await Promise.all([
      getArticles("?language=ar&ordering=-published_at&page_size=12"),
      sectionFeed("egypt"),
      sectionFeed("gulf"),
      sectionFeed("world", 7),
      sectionFeed("economy"),
      sectionFeed("sports"),
      sectionFeed("art"),
      sectionFeed("tech"),
      getVideos("?page_size=4"),
      getArticles("?language=ar&kind=opinion&page_size=6"),
      getArticles("?language=ar&ordering=-views&page_size=5"),
      getTags(),
      getArticles("?language=ar&ordering=-comment_count&page_size=6"),
      getStories(),
      getMatches(),
      getSections(),
    ]);

  // The tail: every section without a bespoke block above. Empty ones are
  // dropped rather than rendered as a bare heading.
  const tailSections = sections.results.filter((s) => !CURATED_KEYS.includes(s.key));
  const tailFeeds = await Promise.all(tailSections.map((s) => sectionFeed(s.key, 4)));
  const tail = tailSections
    .map((section, i) => ({ section, articles: tailFeeds[i].results }))
    .filter(({ articles }) => articles.length);

  // The hero rotates the top stories; the side rail carries what isn't in it.
  const heroSlides = recent.results.slice(0, 5).map((a) => ({
    href: `/article/${a.slug}`,
    title: a.title,
    section: a.section_name,
    time: relativeTime(a.published_at, "ar"),
    badge: a.badge,
    imageSrc: mediaUrl(a.cover_image),
  }));
  const heroIds = new Set(recent.results.slice(0, 5).map((a) => a.id));
  const heroSide = recent.results.filter((a) => !heroIds.has(a.id)).slice(0, 4);

  const videoCards = videos.results.map((v) => ({
    href: `/video/${v.slug}`,
    title: v.title,
    section: "لقطة وتعليق",
    time: relativeTime(v.created_at, "ar"),
    badge: (v.is_exclusive ? "exclusive" : "none") as Badge,
    imageSrc: mediaUrl(v.cover_image),
    isVideo: true,
    videoDuration: v.duration_label,
    comments: v.comment_count,
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
      <StoriesRail lang="ar" stories={stories.results} />

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

      <SectionBlock lang="ar" title="شؤون مصر" seeAllHref="/section/egypt" cards={egypt.results.map(toSectionCard)} initialCount={4} />
      <SectionDivider />

      {gulf.results.length ? (
        <>
          <SectionBlock lang="ar" title="الخليج العربي" seeAllHref="/section/gulf" cards={gulf.results.map(toSectionCard)} initialCount={4} />
          <SectionDivider />
        </>
      ) : null}

      {/* عرب وعالم — its own front-page treatment (lead + rail + tiles, red
          category chips on the photos), deliberately not the «ثقافة وفن» grid. */}
      <WorldNewsBlock title="عرب وعالم" href="/section/world" cards={world.results.map(toWorldCard)} />
      {world.results.length ? <SectionDivider /> : null}

      <SectionBlock lang="ar" title="حركة السوق" seeAllHref="/section/economy" cards={econ.results.map(toSectionCard)} initialCount={4} />
      <SectionDivider />

      {/* ثقافة وفن — image-forward cards, so it reads differently from the
          text-dense sections above it. */}
      {art.results.length ? (
        <section className="mx-auto max-w-container px-6 py-6">
          <SectionHeading lang="ar" title="ثقافة وفن" href="/section/art" />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
            {art.results.slice(0, 3).map((a) => (
              <ArticleCard key={a.id} lang="ar" variant="standard" {...toSectionCard(a)} />
            ))}
          </div>
        </section>
      ) : null}

      <SectionDivider />

      {/* علوم وتكنولوجيا — arrow-navigated rail (the عكاظ pattern). */}
      {tech.results.length ? (
        <section className="mx-auto max-w-container px-6 py-6">
          <SectionHeading lang="ar" title="علوم وتكنولوجيا" href="/section/tech" />
          <ArrowCarousel lang="ar" itemClassName="w-[300px]">
            {tech.results.map((a) => (
              <ArticleCard key={a.id} lang="ar" variant="standard" {...toSectionCard(a)} />
            ))}
          </ArrowCarousel>
        </section>
      ) : null}

      <SectionDivider />
      <SectionBlock lang="ar" title="لقطة وتعليق" seeAllHref="/video" cards={videoCards} initialCount={4} />
      <SectionDivider />
      <SectionBlock lang="ar" title="جوّه الجون" seeAllHref="/section/sports" cards={sports.results.map(toSectionCard)} initialCount={4} />
      <MatchesRail matches={matches.results} />

      {/* ستايل ونجوم / أمن ومحاكم / ملف خاص / دليلك الأول — and anything added
          later. Rendered here rather than left to /section/… pages. */}
      {tail.map(({ section, articles }) => (
        <div key={section.key}>
          <SectionDivider />
          <SectionBlock
            lang="ar"
            title={section.name_ar}
            seeAllHref={`/section/${section.key}`}
            cards={articles.map(toSectionCard)}
            initialCount={4}
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
            <div className="border-s-[3px] border-brand ps-3 font-display-ar text-[15px] font-extrabold text-ink">وسوم رائجة</div>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {tags.results.slice(0, 5).map((t) => (
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
