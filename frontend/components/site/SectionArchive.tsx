"use client";

import { useMemo, useState } from "react";

import ArticleCard from "@/components/site/ArticleCard";
import { toEasternNumerals } from "@/lib/format";
import type { Badge } from "@/lib/types";

export type ArchiveCard = {
  id: number;
  href: string;
  title: string;
  section?: string;
  time: string;
  badge: Badge;
  imageSrc?: string;
  views: number;
};

const PAGE_SIZE = 6;

export default function SectionArchive({
  lang,
  cards,
  accent,
}: {
  lang: "ar" | "en";
  cards: ArchiveCard[];
  /** The section's own colour — tabs, pagination and card kickers all take it,
   *  so an archive page looks like the section it belongs to rather than like
   *  every other archive page. */
  accent?: string;
}) {
  const [tab, setTab] = useState<"latest" | "popular">("latest");
  const [page, setPage] = useState(1);
  const isAr = lang === "ar";

  const sorted = useMemo(() => (tab === "popular" ? [...cards].sort((a, b) => b.views - a.views) : cards), [tab, cards]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // The selected state is painted inline because the colour is per-section
  // and Tailwind cannot generate a class it never sees as a literal.
  const chipClass = (active: boolean) =>
    `rounded-pill border px-4 py-2 text-[13px] font-semibold ${active ? "text-paper" : "border-line bg-paper text-ink"}`;
  const activeFill = accent ? { backgroundColor: accent, borderColor: accent } : undefined;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setTab("latest");
              setPage(1);
            }}
            className={chipClass(tab === "latest")}
            style={tab === "latest" ? activeFill : undefined}
          >
            {isAr ? "الأحدث" : "Latest"}
          </button>
          <button
            onClick={() => {
              setTab("popular");
              setPage(1);
            }}
            className={chipClass(tab === "popular")}
            style={tab === "popular" ? activeFill : undefined}
          >
            {isAr ? "الأكثر قراءة" : "Most Read"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
        {visible.map((c) => (
          <ArticleCard
            key={c.id}
            lang={lang}
            variant="standard"
            href={c.href}
            title={c.title}
            section={c.section}
            time={c.time}
            badge={c.badge}
            imageSrc={c.imageSrc}
            accent={accent}
          />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`tnum flex h-9 w-9 items-center justify-center rounded-md border text-[14px] font-bold ${
                n === currentPage ? "text-paper" : "border-line bg-paper text-ink"
              }`}
              style={n === currentPage ? activeFill : undefined}
            >
              {isAr ? toEasternNumerals(n) : n}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
