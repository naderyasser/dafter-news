"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Chevron from "@/components/ui/Chevron";
import SectionMore from "@/components/site/SectionMore";

export type OpinionItem = { name: string; quote: string; href: string; initial: string; avatar?: string; time?: string };

const AUTOPLAY_MS = 5000;
const CARD_STEP = 316; // card width + gap

export default function OpinionCarousel({
  lang,
  items,
  seeAllHref,
  hideHeading = false,
}: {
  lang: "ar" | "en";
  items: OpinionItem[];
  seeAllHref: string;
  /** The opinion SECTION page already says «بالعقل والمنطق» in its own
   *  masthead directly above — repeating it inside the band reads like a
   *  stutter. The home page keeps the heading. */
  hideHeading?: boolean;
}) {
  const isAr = lang === "ar";
  const fontBody = isAr ? "font-body-ar" : "font-body-en";
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const scroll = useCallback(
    (dir: 1 | -1) => {
      const el = ref.current;
      if (!el) return;
      el.scrollBy({ left: CARD_STEP * dir * (isAr ? -1 : 1), behavior: "smooth" });
    },
    [isAr],
  );

  // Auto-advance, wrapping back to the start once the last card is shown.
  useEffect(() => {
    if (paused || reducedMotion.current || items.length < 2) return;
    const id = window.setInterval(() => {
      const el = ref.current;
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      if (Math.abs(el.scrollLeft) >= max - 1) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        scroll(1);
      }
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, scroll, items.length]);

  // Every sibling band on the homepage (HeroSlider, VideoShowcase,
  // SportsBlock, SpecialFilesBlock) hides itself rather than showing a
  // heading over nothing on a quiet day — this one didn't, and the opinion
  // desk is thin enough right now (a couple of live pieces at a time) for
  // that gap to be a real, not just theoretical, risk. Arrow buttons over
  // an empty scroller read as broken, not quiet. After the hooks, not
  // before: an early return ahead of useCallback/useEffect would skip them
  // on an empty render and violate the Rules of Hooks the moment items
  // goes from empty to non-empty between renders.
  if (!items.length) return null;

  return (
    <section
      className={`${fontBody} bg-navy py-10`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <div className="mx-auto mb-5 flex max-w-container flex-wrap items-center justify-between gap-4 px-6">
        {hideHeading ? (
          <span aria-hidden />
        ) : (
          <div className="flex items-center gap-4">
            <span className={`${fontDisplay} rule-accent rule-on-dark ps-3.5 text-h2 font-extrabold text-paper`}>
              {isAr ? "بالعقل والمنطق" : "By Reason & Logic"}
            </span>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => scroll(-1)}
            aria-label={isAr ? "السابق" : "Previous"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-navy-2 bg-transparent text-paper transition-colors duration-fast hover:border-brand hover:bg-brand"
          >
            <Chevron lang={lang} dir="back" className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll(1)}
            aria-label={isAr ? "التالي" : "Next"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-navy-2 bg-transparent text-paper transition-colors duration-fast hover:border-brand hover:bg-brand"
          >
            <Chevron lang={lang} className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div ref={ref} className="mx-auto flex max-w-container snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((op, i) => (
          <Link
            key={op.href + i}
            href={op.href}
            className="flex w-[300px] flex-shrink-0 snap-start flex-col gap-3.5 rounded-card border border-navy-2 bg-navy-2 p-6 no-underline transition-colors duration-fast hover:border-brand"
          >
            <span className="font-serif text-[40px] font-extrabold leading-[.6] text-brand">&ldquo;</span>
            <div className="flex-1 text-[16px] font-semibold leading-[1.6] text-paper">{op.quote}</div>
            <div className="mt-2 flex items-center gap-2.5">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-brand bg-navy text-[15px] font-extrabold text-header-ink">
                {op.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={op.avatar} alt={op.name} className="h-full w-full object-cover" />
                ) : (
                  op.initial
                )}
              </div>
              <span className="flex min-w-0 flex-col">
                <span className="text-[13px] text-header-muted">{op.name}</span>
                {op.time && <span className="tnum text-[11.5px] text-header-muted/70">{op.time}</span>}
              </span>
              <Chevron lang={lang} className="ms-auto h-4 w-4 flex-shrink-0 text-brand" />
            </div>
          </Link>
        ))}
      </div>
      <div className="mx-auto max-w-container px-6">
        <SectionMore lang={lang} href={seeAllHref} tone="dark" />
      </div>
    </section>
  );
}
