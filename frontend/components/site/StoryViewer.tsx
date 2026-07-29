"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { mediaUrl } from "@/lib/api";
import type { Story } from "@/lib/types";
import Chevron from "@/components/ui/Chevron";

/**
 * One dwell per story — the viewer's timer and the rail's flip interval.
 * Lives here rather than in StoriesRail because the rail imports the viewer;
 * declaring it the other way round would make the two modules circular.
 */
export const STORY_MS = 5000;

const T = {
  ar: { close: "إغلاق", prev: "السابق", next: "التالي", read: "اقرأ الخبر", label: "أهم ما يجري اليوم" },
  en: { close: "Close", prev: "Previous", next: "Next", read: "Read the story", label: "Today's stories" },
};

/**
 * Full-screen story viewer: one segmented timer per story across the top,
 * auto-advance, hold-to-pause, and prev/next on both taps and arrow keys.
 *
 * Rendered through a portal on document.body rather than in place, because
 * the rail sits inside the page's stacking and overflow contexts — a fixed
 * overlay nested in it would be clipped by the rail's own `overflow-x`.
 *
 * Advancing past the last story closes the viewer rather than looping. A
 * loop is right for a hero carousel, where there is no end state; here the
 * reader has finished the set, and trapping them in it is the difference
 * between a feature and a lightbox they have to fight.
 */
export default function StoryViewer({
  lang,
  stories,
  startAt,
  onClose,
}: {
  lang: "ar" | "en";
  stories: Story[];
  startAt: number;
  onClose: (landedOn: number) => void;
}) {
  const isAr = lang === "ar";
  const t = T[lang];
  const [index, setIndex] = useState(startAt);
  const [held, setHeld] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);
  // Read at close time, so the caller is told where the reader actually
  // stopped rather than the index that was current when the effect was set up.
  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const close = useCallback(() => onClose(indexRef.current), [onClose]);

  // Computed off `index` rather than inside a setState updater: the updater
  // would have to call the parent's onClose as a side effect, which React is
  // free to run twice.
  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next < 0) return;
      if (next >= stories.length) return close();
      setIndex(next);
    },
    [index, stories.length, close],
  );

  // Under reduced motion the timer never runs, so the viewer waits for an
  // explicit tap instead of advancing on its own.
  const running = !held && !reduced;

  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => go(1), STORY_MS);
    return () => window.clearTimeout(id);
  }, [running, index, go]);

  // Arrow keys follow reading direction, so «التالي» is always the key that
  // points forward on screen rather than a fixed ArrowRight.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      if (e.key === "ArrowLeft") return go(isAr ? 1 : -1);
      if (e.key === "ArrowRight") return go(isAr ? -1 : 1);
      if (e.key === " ") {
        e.preventDefault();
        setHeld((h) => !h);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, close, isAr]);

  // The page behind must not scroll while a full-screen overlay is up.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!mounted || !stories.length) return null;
  const story = stories[index];
  const img = mediaUrl(story.image);

  return createPortal(
    <div
      dir={isAr ? "rtl" : "ltr"}
      lang={lang}
      role="dialog"
      aria-modal="true"
      aria-label={t.label}
      className={`fixed inset-0 z-[120] flex items-center justify-center bg-navy-strong/95 ${
        isAr ? "font-body-ar" : "font-body-en"
      }`}
      onClick={close}
    >
      {/* The frame keeps a phone-shaped aspect on desktop instead of stretching
          a portrait photo across a widescreen monitor. */}
      <div
        className="animate-fade-in relative flex h-full max-h-[100dvh] w-full max-w-[460px] flex-col overflow-hidden bg-navy sm:h-[92vh] sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* segmented timers — one per story */}
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 p-3">
          {stories.map((s, i) => (
            <div key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-pill bg-[rgba(255,255,255,.3)]">
              <div
                // Only the live segment animates; the ones behind are filled
                // outright and the ones ahead stay empty.
                key={i === index ? `live-${index}` : `static-${i}`}
                className={`h-full rounded-pill bg-paper ${isAr ? "origin-right" : "origin-left"} ${
                  i === index && running ? "animate-story-fill" : ""
                }`}
                style={{
                  animationDuration: `${STORY_MS}ms`,
                  transform: i < index || (i === index && !running) ? "scaleX(1)" : i > index ? "scaleX(0)" : undefined,
                }}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={close}
          aria-label={t.close}
          className="absolute end-3 top-8 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(6,38,57,.6)] text-[18px] text-paper hover:bg-[rgba(6,38,57,.9)]"
        >
          ✕
        </button>

        {/* Hold anywhere to pause, the gesture readers already know from
            Instagram. onPointer* rather than onMouse* so a touch hold works. */}
        <div
          className="relative flex-1"
          onPointerDown={() => setHeld(true)}
          onPointerUp={() => setHeld(false)}
          onPointerCancel={() => setHeld(false)}
          onPointerLeave={() => setHeld(false)}
        >
          {img ? (
            <Image key={story.id} src={img} alt="" fill sizes="100vw" className="animate-fade-in object-cover" />
          ) : (
            <div className="absolute inset-0 bg-navy-2" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-navy-strong via-[rgba(6,38,57,.25)] to-[rgba(6,38,57,.45)]" />

          {/* Tap zones. Placed under the caption (z-0 vs z-10) so the CTA stays
              clickable rather than being covered by the "next" half. */}
          <button
            type="button"
            aria-label={t.prev}
            onClick={() => go(-1)}
            className="absolute inset-y-0 start-0 z-0 w-1/3 cursor-default"
          />
          <button
            type="button"
            aria-label={t.next}
            onClick={() => go(1)}
            className="absolute inset-y-0 end-0 z-0 w-1/3 cursor-default"
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-6">
            {story.section_name ? (
              <div className="mb-2 inline-block rounded-badge bg-accent px-2.5 py-1 text-[11.5px] font-bold text-paper">
                {story.section_name}
              </div>
            ) : null}
            <h3
              className={`${isAr ? "font-display-ar" : "font-display-en"} m-0 text-[21px] font-extrabold leading-[1.5] text-paper`}
            >
              {story.title}
            </h3>
            {story.href ? (
              <Link
                href={story.href}
                className="pointer-events-auto mt-4 inline-flex items-center gap-2 rounded-pill bg-paper px-5 py-2 text-[13.5px] font-bold text-navy no-underline hover:bg-navy-tint"
              >
                {t.read}
                <Chevron lang={lang} className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
