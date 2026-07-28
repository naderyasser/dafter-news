"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import CoverImage from "@/components/ui/CoverImage";

export type VerticalNewsItem = {
  href: string;
  title: string;
  kicker?: string | null;
  time?: string;
  imageSrc?: string | null;
};

const AUTOPLAY_MS = 6000;

const T = {
  ar: { live: "مباشر", heading: "التغطية المباشرة", prev: "السابق", next: "التالي", drop: "أفلت صورة الخبر هنا" },
  en: { live: "Live", heading: "Live coverage", prev: "Previous", next: "Next", drop: "Drop image here" },
};

/**
 * Vertical news carousel — the الشرق pattern the client pointed at: one story
 * at a time in a fixed-height frame, the stack sliding up and down rather
 * than across, with dots underneath.
 *
 * Vertical is the whole point, so the track is translated on Y and the frame
 * has a fixed height. That fixed height is also what keeps the promise that
 * «باقي عناصر الصفحة تكتمل بشكل طبيعي أسفله»: the block never reflows as it
 * advances, so nothing below it moves while a reader is looking at it.
 *
 * Every slide stays mounted and in the DOM — hidden ones are marked
 * aria-hidden and taken out of the tab order rather than unmounted, so the
 * slide transition has something to slide and a crawler still sees all the
 * headlines.
 */
export default function VerticalNewsCarousel({
  lang,
  items,
  isLive = false,
  heading,
  href,
}: {
  lang: "ar" | "en";
  items: VerticalNewsItem[];
  /** Shows the pulsing «مباشر» tag — set when a stream is actually running. */
  isLive?: boolean;
  heading?: string;
  href?: string;
}) {
  const isAr = lang === "ar";
  const t = T[lang];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => setVisible(e[0]?.isIntersecting ?? false), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const go = useCallback(
    (delta: number) => setIndex((i) => (items.length ? (i + delta + items.length) % items.length : 0)),
    [items.length],
  );

  const running = !paused && visible && !reduced && items.length > 1;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => go(1), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [running, go]);

  if (!items.length) return null;

  return (
    <section className="mx-auto max-w-container px-6 py-8">
      <div className="rule-accent mb-4 flex flex-wrap items-center justify-between gap-3 ps-3.5">
        <div className="flex items-center gap-2.5">
          <h2 className={`${isAr ? "font-display-ar" : "font-display-en"} m-0 text-h2 font-extrabold text-ink`}>
            {heading ?? t.heading}
          </h2>
          {isLive ? (
            <span className="flex items-center gap-1.5 rounded-pill bg-brand px-2.5 py-1 text-[11px] font-extrabold text-paper">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-paper" aria-hidden />
              {t.live}
            </span>
          ) : null}
        </div>
        <span className="tnum text-caption text-ink-3">
          {index + 1}/{items.length}
        </span>
      </div>

      <div
        ref={frameRef}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        className="relative overflow-hidden rounded-card border border-line bg-paper"
        aria-roledescription="carousel"
        aria-label={heading ?? t.heading}
      >
        {/* Fixed frame height; the track inside is items.length × that, and is
            shifted by whole frames. Percentages would resolve against the
            track's own (much taller) height, not the frame's. */}
        <div className="relative h-[300px] sm:h-[260px]">
          <div
            className="absolute inset-x-0 top-0 transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none"
            style={{ transform: `translateY(-${index * 100}%)`, height: `${items.length * 100}%` }}
          >
            {items.map((item, i) => (
              <div key={item.href + i} style={{ height: `${100 / items.length}%` }} aria-hidden={i !== index}>
                <Link
                  href={item.href}
                  tabIndex={i === index ? undefined : -1}
                  className="card-link flex h-full gap-4 p-4 no-underline sm:gap-5 sm:p-5"
                >
                  <div className="relative hidden w-[220px] flex-shrink-0 overflow-hidden rounded-card sm:block">
                    <CoverImage src={item.imageSrc} alt={item.title} placeholder={t.drop} className="absolute inset-0" sizes="220px" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                    {item.kicker ? <span className="text-xs font-bold text-accent">{item.kicker}</span> : null}
                    <h3
                      className={`${isAr ? "font-display-ar" : "font-display-en"} card-title m-0 text-[clamp(1.0625rem,0.95rem+0.6vw,1.375rem)] font-extrabold leading-[1.5] text-ink`}
                    >
                      {item.title}
                    </h3>
                    {item.time ? <span className="text-caption text-ink-3">{item.time}</span> : null}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>

        {items.length > 1 ? (
          <>
            {/* Up/down, because the motion is vertical — a left/right chevron
                here would promise a direction the carousel does not move in. */}
            <button
              type="button"
              aria-label={t.prev}
              onClick={() => go(-1)}
              className="absolute end-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-paper text-[13px] text-ink-3 transition-colors duration-fast hover:border-accent hover:text-accent"
            >
              ▲
            </button>
            <button
              type="button"
              aria-label={t.next}
              onClick={() => go(1)}
              className="absolute bottom-3 end-3 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-paper text-[13px] text-ink-3 transition-colors duration-fast hover:border-accent hover:text-accent"
            >
              ▼
            </button>
          </>
        ) : null}
      </div>

      {items.length > 1 ? (
        <div className="mt-3.5 flex justify-center gap-2">
          {items.map((item, i) => (
            <button
              key={item.href + i}
              type="button"
              aria-label={`${isAr ? "خبر" : "Story"} ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-pill transition-all duration-med ${
                i === index ? "w-7 bg-brand" : "w-2.5 bg-line-strong hover:bg-accent"
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
