"use client";

import { useState } from "react";

import ArticleCard from "@/components/site/ArticleCard";
import type { Badge } from "@/lib/types";

export type SectionBlockCard = {
  href: string;
  title: string;
  section?: string;
  time?: string;
  badge?: Badge;
  imageSrc?: string | null;
  isVideo?: boolean;
  videoDuration?: string;
  comments?: number;
};

export default function SectionBlock({
  lang,
  title,
  seeAllHref,
  cardVariant = "standard",
  cards,
  initialCount,
}: {
  lang: "ar" | "en";
  title: string;
  seeAllHref: string;
  cardVariant?: "standard" | "compact" | "text" | "hero";
  cards: SectionBlockCard[];
  initialCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const isAr = lang === "ar";
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const limit = initialCount ?? cards.length;
  const canExpand = cards.length > limit;
  const visible = expanded || !canExpand ? cards : cards.slice(0, limit);

  return (
    <section className="mx-auto max-w-container px-6 py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-s-[3px] border-brand ps-3.5">
        <h2 className={`${fontDisplay} m-0 text-[clamp(1.1875rem,1rem+0.8vw,1.375rem)] font-extrabold text-ink`}>{title}</h2>
        <a href={seeAllHref} className="whitespace-nowrap text-[14px] font-semibold text-brand no-underline hover:text-brand-strong">
          {isAr ? "عرض الكل ←" : "See all →"}
        </a>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
        {visible.map((c, i) => (
          <ArticleCard
            key={c.href + i}
            lang={lang}
            variant={cardVariant}
            href={c.href}
            title={c.title}
            section={c.section}
            time={c.time}
            badge={c.badge ?? "none"}
            imageSrc={c.imageSrc}
            isVideo={c.isVideo}
            videoDuration={c.videoDuration}
            comments={c.comments}
          />
        ))}
      </div>
      {canExpand && !expanded && (
        <div className="mt-6 text-center">
          <button
            onClick={() => setExpanded(true)}
            className="rounded-pill border border-line bg-paper px-7 py-2.5 text-[14px] font-semibold text-ink hover:border-line-strong hover:bg-surface"
          >
            {isAr ? "عرض المزيد" : "Show more"}
          </button>
        </div>
      )}
    </section>
  );
}
