"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import StoryViewer, { STORY_MS } from "@/components/site/StoryViewer";
import type { Story } from "@/lib/types";
import { mediaUrl } from "@/lib/api";

/**
 * Social-style stories strip: tall cards in a horizontally scrollable rail
 * that advances on its own, under a timer bar showing when the next flip is
 * due. Tapping a card opens the full-screen viewer.
 *
 * Scrolling stays native (overflow-x + scroll snap) rather than becoming a
 * JS-transformed track, so a trackpad, a touch swipe and keyboard focus all
 * still work, and it reverses correctly in RTL for free. Autoplay only nudges
 * that same scroll position.
 *
 * Three things switch autoplay off, and all three are the same bug in
 * different clothes — the page moving under someone who is reading it:
 * pointer/focus inside the rail, the rail scrolled out of view, and
 * prefers-reduced-motion.
 */
export default function StoriesRail({ lang, stories }: { lang: "ar" | "en"; stories: Story[] }) {
  const isAr = lang === "ar";
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // A rail that is off-screen must not advance: scrolling it would drag the
  // reader's viewport back up to it.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => setVisible(entries[0]?.isIntersecting ?? false), {
      threshold: 0.35,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /**
   * Bring card `i` to the rail's inline start.
   *
   * Deliberately `scrollBy` with a delta measured off getBoundingClientRect,
   * not `scrollLeft = …` and not `scrollIntoView`: scrollLeft's origin and
   * sign in RTL still differ between engines, and scrollIntoView is free to
   * scroll ancestors, which is exactly the viewport-yanking this is trying to
   * avoid. Visual rects are the one coordinate space that behaves the same in
   * both directions.
   */
  const scrollToIndex = useCallback((i: number) => {
    const track = trackRef.current;
    const card = track?.children[i] as HTMLElement | undefined;
    if (!track || !card) return;
    const delta = card.getBoundingClientRect().left - track.getBoundingClientRect().left;
    track.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  const running = !paused && visible && !reduced && viewerAt === null && stories.length > 1;

  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => {
      const next = (index + 1) % stories.length;
      setIndex(next);
      scrollToIndex(next);
    }, STORY_MS);
    return () => window.clearTimeout(id);
  }, [running, index, stories.length, scrollToIndex]);

  if (!stories.length) return null;

  return (
    <section className="border-b border-line bg-paper py-5">
      <div className="mx-auto max-w-container px-6">
        <div className="mb-3 flex items-end justify-between gap-4">
          <h2
            className={`${isAr ? "font-display-ar" : "font-display-en"} rule-accent inline-block ps-3.5 text-[17px] font-extrabold text-ink`}
          >
            {isAr ? "أهم ما يجري اليوم" : "Today's top stories"}
          </h2>
          <span className="tnum text-caption text-ink-3">
            {index + 1}/{stories.length}
          </span>
        </div>

        {/*
          The timer. `key` is the index so React replaces the node on every
          flip, which restarts the CSS animation — re-setting animation-name
          on the same node would not. It is aria-hidden because the count
          beside the heading already says the same thing in text.
        */}
        <div className="mb-3 h-[3px] overflow-hidden rounded-pill bg-surface-2" aria-hidden>
          <div
            key={index}
            className={`h-full rounded-pill bg-accent ${isAr ? "origin-right" : "origin-left"} ${
              running ? "animate-story-fill" : ""
            }`}
            style={{ animationDuration: `${STORY_MS}ms`, transform: running ? undefined : "scaleX(1)" }}
          />
        </div>

        <div
          ref={trackRef}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
          className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {stories.map((s, i) => {
            const img = mediaUrl(s.image);
            return (
              <Link
                key={s.id}
                href={s.href || "#"}
                // Stays an anchor with a real href so it is crawlable and still
                // works with JS off; the viewer is the enhancement on top.
                onClick={(e) => {
                  e.preventDefault();
                  setViewerAt(i);
                }}
                aria-current={i === index || undefined}
                // The ring marks which card the timer is counting down; the
                // rest sit on a hairline so the active one is the only thing
                // the eye has to track.
                className={`group relative flex aspect-[9/16] w-[128px] flex-shrink-0 snap-start flex-col justify-end overflow-hidden rounded-card border-2 bg-navy-2 no-underline transition-colors duration-med sm:w-[142px] ${
                  i === index ? "border-accent" : "border-line"
                }`}
              >
                {img ? (
                  <Image
                    src={img}
                    alt=""
                    fill
                    sizes="132px"
                    className="object-cover transition-transform duration-med group-hover:scale-105"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-navy via-[rgba(11,52,84,.35)] to-transparent" />
                <div className="relative p-2.5">
                  {s.section_name ? (
                    <div className="mb-1 text-[10.5px] font-bold text-navy-tint">{s.section_name}</div>
                  ) : null}
                  <div className="line-clamp-3 text-[12.5px] font-bold leading-[1.5] text-paper">{s.title}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {viewerAt !== null ? (
        <StoryViewer
          lang={lang}
          stories={stories}
          startAt={viewerAt}
          onClose={(landedOn) => {
            setViewerAt(null);
            // Come back to whichever story they left on, so closing the viewer
            // doesn't rewind the rail to where they opened it.
            setIndex(landedOn);
            scrollToIndex(landedOn);
          }}
        />
      ) : null}
    </section>
  );
}
