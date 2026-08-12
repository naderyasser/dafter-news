"use client";

import Link from "next/link";
import { useState } from "react";

import Chevron from "@/components/ui/Chevron";
import CoverImage from "@/components/ui/CoverImage";
import SectionHeading from "@/components/site/SectionHeading";
import type { Badge } from "@/lib/types";

export type HeroCarouselCard = {
  href: string;
  title: string;
  time?: string;
  badge?: Badge;
  /** The red tag riding the photo's top-start corner — the article's own
   *  `subcategory` («حرب إيران»), falling back to the section name so it's
   *  never blank. Same field WorldNewsBlock's chip reads, same reason: the
   *  model's own help text calls it "وسم أحمر على البطاقة" — a red tag on
   *  the card — which is exactly this corner. */
  chip?: string;
  imageSrc?: string | null;
};

const T = {
  ar: { drop: "أفلت صورة الخبر هنا", breaking: "عاجل", live: "مباشر", exclusive: "خاص", prev: "السابق", next: "التالي" },
  en: { drop: "Drop image here", breaking: "Breaking", live: "Live", exclusive: "Exclusive", prev: "Previous", next: "Next" },
};

/** The top-start red pill — either the status badge (عاجل/مباشر/خاص) when
 *  set, else the subcategory chip. The two never both show: a card is either
 *  flagged urgent right now or filed under a topic, and stacking both in the
 *  same corner is what BadgeChip/PhotoChip elsewhere keep apart by using two
 *  different corners — here there's only one corner in the reference, so the
 *  badge wins when there is one. */
function CornerTag({ card, lang }: { card: HeroCarouselCard; lang: "ar" | "en" }) {
  const t = T[lang];
  const badge = card.badge && card.badge !== "none" ? card.badge : null;
  const label = badge ? { breaking: t.breaking, live: t.live, exclusive: t.exclusive }[badge] : card.chip;
  if (!label) return null;
  const gold = badge === "exclusive";
  return (
    <span
      className={`absolute start-2 top-2 z-10 flex items-center rounded-badge ${gold ? "bg-gold" : "bg-badge-breaking"} px-2.5 py-1 text-[11px] font-extrabold text-paper`}
    >
      {badge === "live" && <span className="me-1 h-1.5 w-1.5 animate-pulse-dot rounded-full bg-paper" />}
      {label}
    </span>
  );
}

function Photo({ card, lang, aspect }: { card: HeroCarouselCard; lang: "ar" | "en"; aspect: string }) {
  return (
    <div className={`relative overflow-hidden rounded-card ${aspect}`}>
      <CoverImage src={card.imageSrc} alt={card.title} placeholder={T[lang].drop} className="absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(10,11,13,.9)] via-[rgba(10,11,13,.2)] to-transparent"
      />
      <CornerTag card={card} lang={lang} />
    </div>
  );
}

/** The lead — full width, headline set large directly on the photo. */
function Hero({ card, lang }: { card: HeroCarouselCard; lang: "ar" | "en" }) {
  const fontDisplay = lang === "ar" ? "font-display-ar" : "font-display-en";
  return (
    <Link href={card.href} className="card-link relative block no-underline">
      <Photo card={card} lang={lang} aspect="aspect-[16/9] sm:aspect-[21/9]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5">
        <h3 className={`${fontDisplay} card-title m-0 text-[clamp(1.25rem,1rem+1.6vw,1.875rem)] font-extrabold leading-[1.4] text-paper`}>
          {card.title}
        </h3>
        {card.time && <div className="tnum mt-2 text-[13px] font-semibold text-paper/85">{card.time}</div>}
      </div>
    </Link>
  );
}

/** A carousel tile — same photo treatment, smaller, headline in normal flow
 *  under the photo rather than overlaid (small enough that overlaid text
 *  would crowd the corner tag). */
function Tile({ card, lang }: { card: HeroCarouselCard; lang: "ar" | "en" }) {
  const fontDisplay = lang === "ar" ? "font-display-ar" : "font-display-en";
  return (
    <Link href={card.href} className="card-link block no-underline">
      <Photo card={card} lang={lang} aspect="aspect-[4/3]" />
      <h3 className={`${fontDisplay} card-title mt-2.5 text-[15px] font-bold leading-[1.5] text-ink`}>{card.title}</h3>
    </Link>
  );
}

/**
 * The client's own reference for «سياسة»: one full-width lead, then the
 * rest as a two-up, page-at-a-time carousel — side arrows overlapping the
 * row and dots underneath, rather than ArrowCarousel's free-scroll track
 * with its arrows sitting above it. Built as its own thing instead of
 * reusing ArrowCarousel because the interaction is genuinely different, not
 * just restyled: paged in twos with a fixed dot count, not a scrollable rail
 * with an unbounded end.
 */
export default function HeroCarouselBlock({
  lang,
  title,
  href,
  sectionKey,
  cards,
}: {
  lang: "ar" | "en";
  title: string;
  href: string;
  sectionKey?: string | null;
  cards: HeroCarouselCard[];
}) {
  const perPage = 2;
  const [page, setPage] = useState(0);
  if (!cards.length) return null;

  const [lead, ...rest] = cards;
  const pageCount = Math.ceil(rest.length / perPage);
  const current = Math.min(page, Math.max(pageCount - 1, 0));
  const visible = rest.slice(current * perPage, current * perPage + perPage);

  const arrowBase =
    "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-pill border border-line bg-paper text-ink shadow-2 transition-opacity duration-fast disabled:cursor-default disabled:opacity-0 enabled:hover:border-brand enabled:hover:text-brand";

  return (
    <section className="mx-auto max-w-container px-6 py-8">
      <SectionHeading lang={lang} title={title} href={href} sectionKey={sectionKey} />

      <Hero card={lead} lang={lang} />

      {rest.length > 0 && (
        <div className="relative mt-5">
          {pageCount > 1 && (
            <button
              type="button"
              aria-label={T[lang].prev}
              disabled={current === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className={`${arrowBase} -start-3.5`}
            >
              <Chevron lang={lang} dir="back" className="h-4 w-4" />
            </button>
          )}
          <div className="grid grid-cols-2 gap-4">
            {visible.map((c) => (
              <Tile key={c.href} card={c} lang={lang} />
            ))}
          </div>
          {pageCount > 1 && (
            <button
              type="button"
              aria-label={T[lang].next}
              disabled={current === pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className={`${arrowBase} -end-3.5`}
            >
              <Chevron lang={lang} className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1.5" role="tablist" aria-label={title}>
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === current}
              aria-label={`${i + 1}`}
              onClick={() => setPage(i)}
              className={`h-2 rounded-pill transition-all duration-fast ${
                i === current ? "w-5 bg-brand" : "w-2 bg-line-strong hover:bg-ink-3"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
