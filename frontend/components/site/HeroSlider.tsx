"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Chevron from "@/components/ui/Chevron";

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
const SWIPE_PX = 44;

/**
 * Auto-advancing hero in the الشرق live-coverage style the client pointed at:
 * a full-bleed photograph fading into the navy field, a red-dot kicker over a
 * white pill, one large white headline, and red dots underneath.
 *
 * The text sits in normal flow over the photo rather than being absolutely
 * positioned against its bottom edge. The old overlay was anchored to a fixed
 * 16:9 frame, so any headline that wrapped past two lines grew taller than
 * the frame itself — spilling over the arrows on phones and clipping
 * mid-glyph on desktop. In-flow content can only ever make the frame taller.
 *
 * Autoplay pauses on hover/focus and is skipped under prefers-reduced-motion —
 * a carousel that keeps moving under the pointer is the fastest way to make a
 * headline unclickable. On touch, where there is nothing to hover, the slides
 * answer to a horizontal swipe and the arrows stay hidden.
 */
export default function HeroSlider({ lang, slides }: { lang: "ar" | "en"; slides: Slide[] }) {
  const isAr = lang === "ar";
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(false);
  const touchX = useRef<number | null>(null);

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
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) < SWIPE_PX) return;
        // Mirrored per direction: the "next" slide lives on the inline-end
        // side, so the finger drags toward the start edge to fetch it.
        go((isAr ? dx > 0 : dx < 0) ? 1 : -1);
      }}
      aria-roledescription="carousel"
      aria-label={isAr ? "أهم الأخبار" : "Top stories"}
    >
      {/* Every photo stays mounted so the change is a crossfade rather than a
          hard swap; only the active one is visible. Through next/image, not a
          raw <img>: these are the five heaviest photos on the site, and the
          raw originals put ~2MB above the fold — the optimizer serves the
          same frames as ~70KB webp. The first slide is priority (it IS the
          LCP); the rest keep default loading so they fetch after paint. */}
      <div className="absolute inset-0" aria-hidden>
        {slides.map((s, i) =>
          s.imageSrc ? (
            <Image
              key={s.href + i}
              src={s.imageSrc}
              alt=""
              fill
              priority={i === 0}
              sizes="(min-width: 1024px) 66vw, 100vw"
              className={`object-cover transition-opacity duration-700 ease-out ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
            />
          ) : (
            <div
              key={s.href + i}
              className={`absolute inset-0 bg-navy-2 transition-opacity duration-700 ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
            />
          ),
        )}
        {/* Solid navy at the base so the headline never competes with the
            photo, near-clear at the top so the photo stays a photo. */}
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-[rgba(11,52,84,.62)] to-[rgba(11,52,84,.06)]" />
      </div>

      {/* In flow: the frame is as tall as the text needs, never shorter. */}
      {/* sm:px-16 clears the arrow buttons (they end 56px in): the kicker
          pill sits at the arrows' height on desktop, and 36px of padding put
          it underneath them. */}
      <div className="relative z-[1] flex min-h-[440px] flex-col justify-end px-5 pb-4 pt-28 sm:min-h-[430px] sm:px-16 sm:pb-5 lg:min-h-[480px]">
        {/* Keyed by slide so the text arrives with a soft fade in step with
            the photo behind it. */}
        <div key={slide.href + index} className="flex animate-fade-in flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex items-center gap-2 rounded-pill bg-paper px-3 py-1">
              <span className="h-2 w-2 animate-pulse-dot rounded-full bg-badge-breaking" aria-hidden />
              {/* One label, not two: «عاجل» outranks the section name. */}
              {slide.badge === "breaking" ? (
                <span className="text-[12.5px] font-extrabold text-brand">{isAr ? "عاجل" : "Breaking"}</span>
              ) : slide.section ? (
                <span className="text-[12.5px] font-extrabold text-brand">{slide.section}</span>
              ) : null}
              <Chevron lang={lang} className="h-3 w-3 text-brand" />
            </span>
            {slide.time ? <span className="text-[12.5px] font-semibold text-header-muted">{slide.time}</span> : null}
          </div>

          <Link
            href={slide.href}
            className={`${isAr ? "font-display-ar" : "font-display-en"} max-w-[820px] text-[clamp(1.1875rem,0.95rem+1.5vw,2.375rem)] font-extrabold leading-[1.3] text-paper no-underline`}
          >
            {slide.title}
          </Link>

          {slide.standfirst ? (
            <p className="line-clamp-2 hidden max-w-[720px] text-[14px] leading-relaxed text-header-muted sm:block sm:text-[16px]">
              {slide.standfirst}
            </p>
          ) : null}
        </div>

        {slides.length > 1 ? (
          <div className="mt-4 flex justify-center gap-2 sm:mt-5">
            {slides.map((s, i) => (
              <button
                key={s.href + i}
                type="button"
                aria-label={`${isAr ? "شريحة" : "Slide"} ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-pill transition-all duration-med ${
                  i === index ? "w-7 bg-brand" : "w-2.5 bg-[rgba(255,255,255,.45)] hover:bg-paper"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            aria-label={isAr ? "السابق" : "Previous"}
            onClick={() => go(-1)}
            className="absolute top-1/2 z-[2] hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[rgba(255,255,255,.35)] bg-[rgba(11,52,84,.55)] text-paper transition-colors duration-fast hover:bg-brand sm:start-4 sm:flex"
          >
            <Chevron lang={lang} dir="back" className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={isAr ? "التالي" : "Next"}
            onClick={() => go(1)}
            className="absolute top-1/2 z-[2] hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[rgba(255,255,255,.35)] bg-[rgba(11,52,84,.55)] text-paper transition-colors duration-fast hover:bg-brand sm:end-4 sm:flex"
          >
            <Chevron lang={lang} className="h-4 w-4" />
          </button>
        </>
      ) : null}
    </section>
  );
}
