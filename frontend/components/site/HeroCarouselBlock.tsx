"use client";

import Link from "next/link";
import { useSwipe } from "@/lib/useSwipe";
import { useState } from "react";

import ClockIcon from "@/components/ui/ClockIcon";
import Chevron from "@/components/ui/Chevron";
import CoverImage from "@/components/ui/CoverImage";
import SectionHeading from "@/components/site/SectionHeading";
import SectionMore from "@/components/site/SectionMore";
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

/**
 * The top-start pill — either the status badge (عاجل/مباشر/خاص) when set,
 * else the subcategory chip. The two never both show: a card is either
 * flagged urgent right now or filed under a topic, and stacking both in the
 * same corner is what BadgeChip/PhotoChip elsewhere keep apart by using two
 * different corners — here there's only one corner in the reference, so the
 * badge wins when there is one.
 *
 * Solid red for both cases, deliberately — the client's own reference shows
 * «سياسة» and «ثقافة وفن» tags in the same red on the same screen (a since-
 * superseded revision here tried recolouring the plain-chip case per
 * section; the client's follow-up reference asked for exactly this flat red
 * instead, so it's back).
 */
function CornerTag({ card, lang }: { card: HeroCarouselCard; lang: "ar" | "en" }) {
  const t = T[lang];
  const badge = card.badge && card.badge !== "none" ? card.badge : null;
  const label = badge ? { breaking: t.breaking, live: t.live, exclusive: t.exclusive }[badge] : card.chip;
  if (!label) return null;
  const bg = badge === "exclusive" ? "bg-gold" : "bg-badge-breaking";
  return (
    <span className={`absolute start-2 top-2 z-10 flex items-center rounded-badge ${bg} px-2.5 py-1 text-[11px] font-extrabold text-paper shadow-2 ring-1 ring-inset ring-white/15`}>
      {badge === "live" && <span className="me-1 h-1.5 w-1.5 animate-pulse-dot rounded-full bg-paper" />}
      {label}
    </span>
  );
}

/**
 * Bare photo plus its corner tag — no dark scrim. There used to be one, for
 * a headline set directly on the photo; now that both the lead and the
 * tiles carry their headline in the plain flow underneath (see Hero/Tile),
 * nothing here needs the legibility a gradient buys, and the client's
 * reference shows a clean, un-tinted photo either way.
 */
function Photo({ card, lang, aspect }: { card: HeroCarouselCard; lang: "ar" | "en"; aspect: string }) {
  return (
    <div className={`relative overflow-hidden rounded-card ${aspect}`}>
      <CoverImage src={card.imageSrc} alt={card.title} placeholder={T[lang].drop} className="absolute inset-0" />
      <CornerTag card={card} lang={lang} />
    </div>
  );
}

/**
 * The lead — full width, same "photo, then headline in the normal flow
 * underneath" shape as a tile, just at a bigger size. Used to set the
 * headline in white directly on the photo over a dark gradient; the client's
 * own reference puts it in plain ink below the photo instead, matching every
 * other card on the page rather than being the one exception.
 */
function Hero({ card, lang }: { card: HeroCarouselCard; lang: "ar" | "en" }) {
  const fontDisplay = lang === "ar" ? "font-display-ar" : "font-display-en";
  return (
    <Link href={card.href} className="card-link block no-underline">
      <Photo card={card} lang={lang} aspect="aspect-[16/9] sm:aspect-[21/9] max-h-[480px]" />
      <h3 className={`${fontDisplay} card-title m-0 mt-3 line-clamp-3 text-[clamp(1.125rem,0.95rem+1vw,1.625rem)] font-extrabold leading-[1.4] text-ink`}>
        {card.title}
      </h3>
      {card.time && (
        <div className="tnum mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink-3">
          <ClockIcon />
          {card.time}
        </div>
      )}
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
      {card.time && (
        <div className="tnum mt-1 flex items-center gap-1.5 text-[12px] text-ink-3">
          <ClockIcon className="h-3 w-3" />
          {card.time}
        </div>
      )}
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
  // Finger swipe, same paging the arrows drive. Without it a phone reader had
  // only two 36px arrows to move through the desk.
  const swipe = useSwipe(
    (dir) => setPage((p) => (dir === "next" ? Math.min(pageCount - 1, p + 1) : Math.max(0, p - 1))),
    lang === "ar",
  );
  if (!cards.length) return null;

  const [lead, ...rest] = cards;
  const pageCount = Math.ceil(rest.length / perPage);
  const current = Math.min(page, Math.max(pageCount - 1, 0));
  const visible = rest.slice(current * perPage, current * perPage + perPage);

  // transition-all (not just -opacity) because hover/press now also move the
  // button itself — a scale nudge is what turns "clickable" from a colour
  // change alone into something that feels like it responded to the pointer.
  const arrowBase =
    "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-pill border border-line bg-paper text-ink shadow-2 transition-all duration-fast disabled:cursor-default disabled:opacity-0 enabled:hover:scale-110 enabled:hover:border-brand enabled:hover:text-brand enabled:active:scale-95";

  return (
    <section className="mx-auto max-w-container px-6 py-8">
      <SectionHeading lang={lang} title={title} href={href} sectionKey={sectionKey} />

      <Hero card={lead} lang={lang} />

      {rest.length > 0 && (
        <div className="relative mt-5" {...swipe}>
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
        <div className="mt-4 flex items-center justify-center gap-1" role="tablist" aria-label={title}>
          {Array.from({ length: pageCount }, (_, i) => (
            // The dot itself stays a small 2px mark (that's the visual
            // language every other paged control on the site uses), but the
            // button around it carries real padding — a 2px target is a
            // pointer-precision problem on a touch screen, invisible padding
            // fixes the tap size without inflating what the eye sees.
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === current}
              aria-label={`${i + 1}`}
              onClick={() => setPage(i)}
              className="group p-1"
            >
              <span
                className={`block h-2 rounded-pill transition-all duration-fast ${
                  i === current ? "w-5 bg-brand shadow-1" : "w-2 bg-line-strong group-hover:scale-125 group-hover:bg-ink-3"
                }`}
              />
            </button>
          ))}
        </div>
      )}
      <SectionMore lang={lang} href={href} />
    </section>
  );
}
