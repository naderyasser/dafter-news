import Link from "next/link";

import ArticleCard from "@/components/site/ArticleCard";
import LatestNewsTabs from "@/components/site/LatestNewsTabs";
import MostReadList from "@/components/site/MostReadList";
import OpinionCarousel from "@/components/site/OpinionCarousel";
import SectionBlock from "@/components/site/SectionBlock";
import SiteShell from "@/components/site/SiteShell";
import { getArticles, getTags, getVideos, mediaUrl } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import type { ArticleCard as ArticleCardType, Badge } from "@/lib/types";

export const revalidate = 60;

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

export default async function HomePage() {
  const [recent, egypt, econ, sports, videos, opinion, mostRead, tags, popular] = await Promise.all([
    getArticles("?ordering=-published_at&page_size=12"),
    getArticles("?section__key=egypt&ordering=-published_at&page_size=6"),
    getArticles("?section__key=economy&ordering=-published_at&page_size=6"),
    getArticles("?section__key=sports&ordering=-published_at&page_size=6"),
    getVideos("?page_size=4"),
    getArticles("?kind=opinion&page_size=4"),
    getArticles("?ordering=-views&page_size=5"),
    getTags(),
    getArticles("?ordering=-comment_count&page_size=6"),
  ]);

  const heroMain = recent.results.find((a) => a.badge === "breaking") ?? recent.results[0];
  const heroSide = recent.results.filter((a) => a.id !== heroMain?.id).slice(0, 3);

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
      <div className="mx-auto flex max-w-container flex-wrap gap-5 px-6 py-6">
        <div className="min-w-0 flex-[2_1_480px]">
          {heroMain && (
            <ArticleCard
              lang="ar"
              variant="hero"
              href={`/article/${heroMain.slug}`}
              title={heroMain.title}
              section={heroMain.section_name}
              time={relativeTime(heroMain.published_at, "ar")}
              badge={heroMain.badge}
              imageSrc={mediaUrl(heroMain.cover_image)}
            />
          )}
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

      <SectionBlock lang="ar" title="مصر" seeAllHref="/section/egypt" cards={egypt.results.map(toSectionCard)} initialCount={4} />
      <SectionBlock lang="ar" title="اقتصاد" seeAllHref="/section/economy" cards={econ.results.map(toSectionCard)} initialCount={4} />
      <SectionBlock lang="ar" title="لقطة وتعليق" seeAllHref="/video" cards={videoCards} initialCount={4} />
      <SectionBlock lang="ar" title="رياضة" seeAllHref="/section/sports" cards={sports.results.map(toSectionCard)} initialCount={4} />

      <OpinionCarousel lang="ar" items={opinionItems} seeAllHref="/opinion" />

      <div className="mx-auto flex max-w-container flex-wrap items-start gap-8 px-6 py-8">
        <LatestNewsTabs lang="ar" latest={newsLatest} popular={newsPopular} />
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
          <MostReadList lang="ar" items={mostRead.results.map((a) => ({ title: a.title, href: `/article/${a.slug}`, section: a.section_name }))} />
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
