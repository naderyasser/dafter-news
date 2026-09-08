"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";

import Chevron from "@/components/ui/Chevron";

const T = {
  ar: { prev: "السابق", next: "التالي", goTo: "الانتقال إلى" },
  en: { prev: "Previous", next: "Next", goTo: "Go to" },
};

/**
 * The paged photo rail behind «ثقافة وفن» and «بالعقل والمنطق».
 *
 * A scroll-snap track, so a finger swipe and a trackpad both work natively
 * and RTL reverses for free — plus the three things a native track does not
 * give you and the client's reference has: prev/next arrows sitting on the
 * nameplate row (not floating over the photos), an indicator strip under the
 * rail that follows the scroll position, and an optional slow auto-advance.
 *
 * Every direction-sensitive number goes through `Math.abs(scrollLeft)`, the
 * same normalisation ArrowCarousel uses: engines disagree on the sign of
 * scrollLeft in RTL, but distance-from-start is the same everywhere.
 *
 * The indicator counts PAGES, not cards: with three cards in view the last
 * two cards can never be scrolled to the start edge, so a dot per card would
 * leave two dots that no scroll position ever lights. Pages are derived from
 * how far the track can actually travel.
 *
 * `heading` is rendered as given — the page passes a SectionHeading whose
 * `actions` slot is left empty, and this component supplies the arrows
 * beside it, because only the slider knows whether there is anywhere left
 * to go.
 */
export default function SnapSlider({
  lang,
  heading,
  children,
  itemClassName,
  ariaLabel,
  indicator = "dots",
  autoplayMs,
  tone = "light",
}: {
  lang: "ar" | "en";
  /** The nameplate for the row above the track — its arrows are added here. */
  heading?: React.ReactNode;
  children: React.ReactNode;
  /** Width classes for each slot, e.g. `w-[82%] lg:w-[calc((100%-2rem)/3)]`. */
  itemClassName: string;
  ariaLabel: string;
  /** Round dots (the site's paged-control language) or the reference's flat dashes. */
  indicator?: "dots" | "dashes";
  /** Advance on a timer; paused on hover/focus, skipped under reduced motion. */
  autoplayMs?: number;
  tone?: "light" | "dark";
}) {
  const isAr = lang === "ar";
  const t = T[lang];
  const trackRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(false);
  const count = Children.count(children);

  /** Distance from one snap slot to the next: a slot's width plus the gap. */
  const step = useCallback(() => {
    const el = trackRef.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return 0;
    const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
    return first.offsetWidth + gap;
  }, []);

  const sync = useCallback(() => {
    const el = trackRef.current;
    const s = step();
    if (!el || !s) return;
    const travel = Math.max(0, el.scrollWidth - el.clientWidth);
    const pages = Math.max(1, Math.ceil(travel / s) + 1);
    setPageCount(pages);
    setPage(Math.min(pages - 1, Math.round(Math.abs(el.scrollLeft) / s)));
  }, [step]);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sync();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [sync, count]);

  const goTo = useCallback(
    (index: number) => {
      const el = trackRef.current;
      const s = step();
      if (!el || !s) return;
      const target = Math.max(0, Math.min(pageCount - 1, index));
      // Negative in RTL: the track's start edge is its right edge, and
      // scrolling "forward" moves scrollLeft below zero in every current
      // engine (the same sign convention ArrowCarousel scrolls by).
      el.scrollTo({ left: target * s * (isAr ? -1 : 1), behavior: reducedMotion.current ? "auto" : "smooth" });
    },
    [isAr, pageCount, step],
  );

  useEffect(() => {
    if (!autoplayMs || paused || reducedMotion.current || count < 2) return;
    const id = window.setInterval(() => goTo(page >= pageCount - 1 ? 0 : page + 1), autoplayMs);
    return () => window.clearInterval(id);
  }, [autoplayMs, paused, count, goTo, page, pageCount]);

  if (!count) return null;

  const onDark = tone === "dark";
  const arrowBase = `flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-fast disabled:cursor-default disabled:opacity-35 enabled:hover:scale-110 enabled:active:scale-95 ${
    onDark
      ? "border-white/25 bg-transparent text-paper enabled:hover:border-paper enabled:hover:bg-white/10"
      : "border-line bg-paper text-ink shadow-1 enabled:hover:border-brand enabled:hover:bg-brand enabled:hover:text-paper"
  }`;
  const canPage = pageCount > 1;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {(heading || count > 1) && (
        <div className="mb-4 flex items-center gap-3">
          <div className="min-w-0 flex-1">{heading}</div>
          {count > 1 && (
            <div className="flex flex-shrink-0 gap-2">
              <button type="button" aria-label={t.prev} onClick={() => goTo(page - 1)} disabled={!canPage || page === 0} className={arrowBase}>
                <Chevron lang={lang} dir="back" className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={t.next}
                onClick={() => goTo(page + 1)}
                disabled={!canPage || page >= pageCount - 1}
                className={arrowBase}
              >
                <Chevron lang={lang} className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {Children.map(children, (child, i) => (
          <div key={i} className={`flex-shrink-0 snap-start ${itemClassName}`}>
            {child}
          </div>
        ))}
      </div>

      {canPage && (
        <div className="mt-4 flex items-center justify-center gap-1" role="tablist" aria-label={ariaLabel}>
          {Array.from({ length: pageCount }, (_, i) => (
            // A 2-3px mark with real padding around it: the eye sees the
            // site's small dot, the finger gets a tap target.
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === page}
              aria-label={`${t.goTo} ${i + 1}`}
              onClick={() => goTo(i)}
              className="group p-1"
            >
              <span
                className={`block rounded-pill transition-all duration-fast ${
                  indicator === "dashes" ? "h-[3px]" : "h-2"
                } ${
                  i === page
                    ? `${indicator === "dashes" ? "w-8" : "w-5"} bg-brand shadow-1`
                    : `${indicator === "dashes" ? "w-4" : "w-2"} ${onDark ? "bg-white/30 group-hover:bg-white/60" : "bg-line-strong group-hover:bg-ink-3"} group-hover:scale-110`
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
