import Link from "next/link";

import ArticleCard from "@/components/site/ArticleCard";
import LatestNewsTabs from "@/components/site/LatestNewsTabs";
import MostReadList from "@/components/site/MostReadList";
import OpinionCarousel from "@/components/site/OpinionCarousel";
import SectionBlock from "@/components/site/SectionBlock";
import SiteShell from "@/components/site/SiteShell";
import { getArticles, getTags, mediaUrl } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import type { ArticleCard as ArticleCardType } from "@/lib/types";

export const revalidate = 60;

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

export default async function HomeEnPage() {
  const [recent, egypt, econ, sports, opinion, mostRead, tags] = await Promise.all([
    getArticles("?language=en&ordering=-published_at&page_size=12"),
    getArticles("?language=en&section__key=egypt&ordering=-published_at&page_size=6"),
    getArticles("?language=en&section__key=economy&ordering=-published_at&page_size=6"),
    getArticles("?language=en&section__key=sports&ordering=-published_at&page_size=6"),
    getArticles("?language=en&kind=opinion&page_size=4"),
    getArticles("?language=en&ordering=-views&page_size=5"),
    getTags(),
  ]);

  // Tag.name is a single Arabic column; only surface tags that are actually
  // Latin-script so the English sidebar never shows an Arabic pill.
  const enTags = tags.results.filter((t) => !/[؀-ۿ]/.test(t.name));

  const heroMain = recent.results.find((a) => a.badge === "breaking") ?? recent.results[0];
  const heroSide = recent.results.filter((a) => a.id !== heroMain?.id).slice(0, 3);
  // English opinion links stay on the English side; /opinion is the Arabic
  // route and sent readers from an LTR page into an RTL one.
  const opinionItems = opinion.results.map((a) => ({ name: a.author_name || "", quote: a.title, href: `/en/article/${a.slug}`, initial: a.author_initial || "?" }));
  const newsLatest = recent.results.slice(0, 6).map((a) => ({ href: `/en/article/${a.slug}`, title: a.title, time: relativeTime(a.published_at, "en") }));
  const newsPopular = [...recent.results].sort((a, b) => b.comment_count - a.comment_count).map((a) => ({ href: `/en/article/${a.slug}`, title: a.title, time: `${a.comment_count} comments` }));

  return (
    <SiteShell lang="en" active="home">
      <div className="mx-auto flex max-w-container flex-wrap gap-5 px-6 py-6">
        <div className="min-w-0 flex-[2_1_480px]">
          {heroMain && (
            <ArticleCard lang="en" variant="hero" href={`/en/article/${heroMain.slug}`} title={heroMain.title} section={heroMain.section_name} time={relativeTime(heroMain.published_at, "en")} badge={heroMain.badge} imageSrc={mediaUrl(heroMain.cover_image)} />
          )}
        </div>
        <div className="min-w-0 flex-[1_1_300px]">
          {heroSide.map((a, i) => (
            <div key={a.id} className={i === heroSide.length - 1 ? "" : "mb-3.5 border-b border-line pb-3.5"}>
              <ArticleCard lang="en" variant="compact" href={`/en/article/${a.slug}`} title={a.title} section={a.section_name} time={relativeTime(a.published_at, "en")} badge={a.badge} imageSrc={mediaUrl(a.cover_image)} />
            </div>
          ))}
        </div>
      </div>

      <SectionBlock lang="en" title="Egypt" seeAllHref="#" cards={egypt.results.map(toCard)} initialCount={4} />
      <SectionBlock lang="en" title="Economy" seeAllHref="#" cards={econ.results.map(toCard)} initialCount={4} />
      <SectionBlock lang="en" title="Sports" seeAllHref="#" cards={sports.results.map(toCard)} initialCount={4} />

      {/* Opinion and tags are Arabic-only content today. Render them only
          when there is something in English, so the LTR page never shows an
          Arabic quote or an Arabic tag pill. */}
      {opinionItems.length > 0 && <OpinionCarousel lang="en" items={opinionItems} seeAllHref="/en" />}

      <div className="mx-auto flex max-w-container flex-wrap items-start gap-8 px-6 py-8">
        <LatestNewsTabs lang="en" latest={newsLatest} popular={newsPopular} />
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
          <MostReadList lang="en" items={mostRead.results.map((a) => ({ title: a.title, href: `/en/article/${a.slug}`, section: a.section_name }))} />
          {enTags.length > 0 && (
            <div className="rounded-card border border-line bg-paper p-5">
              <div className="border-s-[3px] border-brand ps-3 font-display-en text-[15px] font-extrabold text-ink">Trending Tags</div>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {enTags.slice(0, 5).map((t) => (
                  <Link key={t.id} href={`/tag/${encodeURIComponent(t.slug)}`} className="rounded-pill bg-brand-tint px-3.5 py-1.5 text-[13px] font-semibold text-brand no-underline hover:bg-brand hover:text-paper">
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
