"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type OpinionItem = { name: string; quote: string; href: string; initial: string };

const AUTOPLAY_MS = 5000;
const CARD_STEP = 316; // card width + gap

export default function OpinionCarousel({
  lang,
  items,
  seeAllHref,
}: {
  lang: "ar" | "en";
  items: OpinionItem[];
  seeAllHref: string;
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
        <div className="flex items-center gap-4">
          <span className={`${fontDisplay} border-s-[3px] border-brand ps-3 text-h2 font-extrabold text-paper`}>
            {isAr ? "بالعقل والمنطق" : "By Reason & Logic"}
          </span>
          <a href={seeAllHref} className="text-[13px] text-header-muted no-underline hover:text-paper">
            {isAr ? "عرض الكل" : "See all"}
          </a>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => scroll(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-navy-2 bg-transparent text-[15px] text-paper transition-colors duration-fast hover:border-brand hover:bg-brand"
          >
            ‹
          </button>
          <button
            onClick={() => scroll(1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-navy-2 bg-transparent text-[15px] text-paper transition-colors duration-fast hover:border-brand hover:bg-brand"
          >
            ›
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
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-brand bg-navy text-[15px] font-extrabold text-header-ink">
                {op.initial}
              </div>
              <span className="text-[13px] text-header-muted">{op.name}</span>
              <span className={`ms-auto text-[18px] text-brand ${isAr ? "-scale-x-100" : ""}`}>→</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
