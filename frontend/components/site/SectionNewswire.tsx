"use client";

import { useMemo, useState } from "react";

import ArticleCard from "@/components/site/ArticleCard";
import CoverImage from "@/components/ui/CoverImage";
import { toEasternNumerals } from "@/lib/format";
import Link from "next/link";
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
  /** Country label on the photo — the geographic desks only. */
  chip?: string;
};

const T = {
  ar: { latest: "الأحدث", popular: "الأكثر قراءة", drop: "أفلت صورة الخبر هنا", more: "المزيد من الأخبار" },
  en: { latest: "Latest", popular: "Most Read", drop: "Drop image here", more: "More stories" },
};

const PAGE_SIZE = 8;

/**
 * The fast-news archetype: one lead story at full width, then a dense
 * time-ordered run of rows.
 *
 * A political or crime desk is read by scanning — the reader wants to know
 * what happened, in order, quickly. An even grid of photo cards makes every
 * story look equally important and fits four to a screen; this puts the
 * desk's judgement first and then gets out of the way, so twice as many
 * headlines are visible without scrolling.
 */
export default function SectionNewswire({
  lang,
  cards,
  accent,
}: {
  lang: "ar" | "en";
  cards: ArchiveCard[];
  accent?: string;
}) {
  const [tab, setTab] = useState<"latest" | "popular">("latest");
  const [page, setPage] = useState(1);
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";

  const sorted = useMemo(() => (tab === "popular" ? [...cards].sort((a, b) => b.views - a.views) : cards), [tab, cards]);
  const [lead, ...rest] = sorted;
  const totalPages = Math.max(1, Math.ceil(rest.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = rest.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const chipClass = (active: boolean) =>
    `rounded-pill border px-4 py-2 text-[13px] font-semibold ${active ? "text-paper" : "border-line bg-paper text-ink"}`;
  const activeFill = accent ? { backgroundColor: accent, borderColor: accent } : undefined;

  if (!cards.length) return null;

  return (
    <>
      <div className="mb-5 flex gap-2">
        <button
          onClick={() => {
            setTab("latest");
            setPage(1);
          }}
          className={chipClass(tab === "latest")}
          style={tab === "latest" ? activeFill : undefined}
        >
          {t.latest}
        </button>
        <button
          onClick={() => {
            setTab("popular");
            setPage(1);
          }}
          className={chipClass(tab === "popular")}
          style={tab === "popular" ? activeFill : undefined}
        >
          {t.popular}
        </button>
      </div>

      {/* The lead: wide photo, the largest headline on the page. */}
      {currentPage === 1 && lead && (
        <Link
          href={lead.href}
          className="card-link mb-6 block no-underline"
          style={accent ? ({ "--card-accent": accent } as React.CSSProperties) : undefined}
        >
          <div className="relative overflow-hidden rounded-card">
            <div className="relative aspect-[16/9]">
              <CoverImage src={lead.imageSrc} alt={lead.title} placeholder={t.drop} className="absolute inset-0" sizes="(min-width: 1024px) 60vw, 100vw" />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(10,11,13,.9)] via-[rgba(10,11,13,.2)] to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <h2 className={`${fontDisplay} m-0 line-clamp-3 text-[clamp(1.0625rem,0.9rem+1vw,1.75rem)] font-extrabold leading-[1.3] text-paper`}>
                {lead.title}
              </h2>
              {lead.time && <div className="mt-2 text-[13px] text-paper/75">{lead.time}</div>}
            </div>
          </div>
        </Link>
      )}

      <div className="flex flex-col">
        {visible.map((c) => (
          <div key={c.id} className="border-b border-line py-3.5 first:border-t">
            <ArticleCard
              lang={lang}
              variant="compact"
              href={c.href}
              title={c.title}
              time={c.time}
              badge={c.badge}
              imageSrc={c.imageSrc}
              chip={c.chip}
              accent={accent}
            />
          </div>
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
