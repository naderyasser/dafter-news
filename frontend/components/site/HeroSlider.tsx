"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Slide = {
  href: string;
  title: string;
  section?: string | null;
  time?: string;
  standfirst?: string | null;
  imageSrc?: string;
  badge?: string;
};

const AUTOPLAY_MS = 6000;

/**
 * Auto-advancing hero carousel on a navy field.
 *
 * Autoplay pauses on hover/focus and while the tab is hidden, and is skipped
 * entirely under prefers-reduced-motion — a carousel that keeps moving under
 * the pointer is the fastest way to make a headline unclickable.
 */
export default function HeroSlider({ lang, slides }: { lang: "ar" | "en"; slides: Slide[] }) {
  const isAr = lang === "ar";
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const go = useCallback(
    (delta: number) => setIndex((i) => (slides.length ? (i + delta + slides.length) % slides.length : 0)),
    [slides.length],
  );

  useEffect(() => {
    if (paused || reducedMotion.current || slides.length < 2) return;
    const id = window.setInterval(() => go(1), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, go, slides.length]);

  if (!slides.length) return null;
  const slide = slides[index];

  return (
    <section
      className="relative overflow-hidden rounded-card bg-navy"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label={isAr ? "أهم الأخبار" : "Top stories"}
    >
      <div className="relative aspect-[16/9] w-full sm:aspect-[2/1]">
        {slide.imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slide.imageSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-navy-2" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-[rgba(16,27,51,.72)] to-transparent" />

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-6 sm:p-9">
          <div className="flex items-center gap-3">
            {slide.badge === "breaking" ? (
              <span className="rounded-badge bg-badge-breaking px-2.5 py-1 text-[12px] font-bold text-paper">
                {isAr ? "عاجل" : "Breaking"}
              </span>
            ) : null}
            {slide.section ? (
              <span className="rounded-badge bg-brand px-2.5 py-1 text-[12px] font-bold text-paper">{slide.section}</span>
            ) : null}
            {slide.time ? <span className="text-[12.5px] text-header-muted">{slide.time}</span> : null}
          </div>

          <Link
            href={slide.href}
            className={`${isAr ? "font-display-ar" : "font-display-en"} max-w-[820px] text-[22px] font-extrabold leading-[1.45] text-paper no-underline sm:text-[34px]`}
          >
            {slide.title}
          </Link>

          {slide.standfirst ? (
            <p className="line-clamp-2 max-w-[720px] text-[14px] leading-relaxed text-header-muted sm:text-[16px]">
              {slide.standfirst}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          aria-label={isAr ? "السابق" : "Previous"}
          onClick={() => go(-1)}
          className="absolute top-1/2 start-4 z-[2] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[rgba(255,255,255,.35)] bg-[rgba(16,27,51,.55)] text-paper transition-colors duration-fast hover:bg-brand"
        >
          <span className={isAr ? "" : "-scale-x-100"}>›</span>
        </button>
        <button
          type="button"
          aria-label={isAr ? "التالي" : "Next"}
          onClick={() => go(1)}
          className="absolute top-1/2 end-4 z-[2] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[rgba(255,255,255,.35)] bg-[rgba(16,27,51,.55)] text-paper transition-colors duration-fast hover:bg-brand"
        >
          <span className={isAr ? "" : "-scale-x-100"}>‹</span>
        </button>

        <div className="absolute bottom-3 start-1/2 z-[2] flex -translate-x-1/2 gap-2">
          {slides.map((s, i) => (
            <button
              key={s.href + i}
              type="button"
              aria-label={`${isAr ? "شريحة" : "Slide"} ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-pill transition-all duration-med ${
                i === index ? "w-7 bg-brand" : "w-2.5 bg-[rgba(255,255,255,.45)]"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
