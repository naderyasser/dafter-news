"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Chevron from "@/components/ui/Chevron";
import SectionHeading from "@/components/site/SectionHeading";
import VideoPlayer from "@/components/site/VideoPlayer";
import { sectionArtUrl } from "@/lib/sections";
import { stripInline } from "@/lib/richtext";

export type ShowcaseVideo = {
  id: number;
  href: string;
  title: string;
  description?: string;
  poster?: string;
  src?: string;
  externalUrl?: string;
  durationLabel?: string;
  isExclusive?: boolean;
  isLive?: boolean;
  views?: number;
  comments?: number;
  time?: string;
};

const SWIPE_PX = 44;
const AUTOPLAY_MS = 6000;

const T = {
  ar: {
    prev: "الفيديو السابق",
    next: "الفيديو التالي",
    watch: "شاهد الفيديو كاملاً",
    playlist: "قائمة الفيديوهات",
    views: "مشاهدة",
    comments: "تعليق",
    live: "مباشر",
    exclusive: "حصري",
    of: "من",
  },
  en: {
    prev: "Previous video",
    next: "Next video",
    watch: "Watch the full video",
    playlist: "Video playlist",
    views: "views",
    comments: "comments",
    live: "Live",
    exclusive: "Exclusive",
    of: "of",
  },
};

/**
 * The video desk as a player, not a grid — the client asked for «مشغل رئيسي
 * بالأعلى، أسهم للتنقل، وشريط صور مصغرة بالأسفل»: pick a thumbnail and the
 * stage changes under it.
 *
 * It sits on a navy band rather than on paper. A 16:9 stage surrounded by
 * white reads as a hole in the page; against the masthead's own blue it reads
 * as the thing the section is for, and gives the eye somewhere to rest between
 * two grids of newsprint.
 *
 * The stage is `VideoPlayer` keyed by video id, not a second player: the embed
 * allow-list, the click-to-load rule (no third-party iframe mounts for readers
 * who merely scroll past) and the no-source case all live there and stay in
 * one place. Remounting on switch is also what stops playback from carrying
 * over — picking a new thumbnail should never leave the previous clip running
 * behind the new poster.
 *
 * Navigation wraps, matching HeroSlider: this is a playlist of eight, with the
 * position spelled out in the counter and every item present in the strip, so
 * an arrow that dead-ends at the edge would just be a control that stopped
 * working. It advances on its own too, same as the hero — but only while the
 * stage is showing a poster: once a clip is actually playing, autoplay stands
 * down so it never yanks the stage out from under someone watching.
 */
export default function VideoShowcase({
  lang,
  title,
  href,
  videos,
}: {
  lang: "ar" | "en";
  title: string;
  href: string;
  videos: ShowcaseVideo[];
}) {
  const isAr = lang === "ar";
  const t = T[lang];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const reducedMotion = useRef(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  // The strip is only scrolled in response to a change of selection. Doing it
  // on mount would drag the page to the rail the moment it hydrates.
  const settled = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  /**
   * The stage is the section's shop window, and the API hands these over
   * newest-first — so a placeholder an editor saved a minute ago, with no
   * cover and no source, opened the whole desk with an empty frame reading
   * «الفيديو غير متاح حالياً». Rank what can actually be shown to the front:
   * a cover first (the stage is mostly a poster), then a playable source.
   *
   * Nothing is dropped — every video keeps its tile in the strip, so an
   * editor still sees what they published. Only the opening frame is chosen.
   * sort() is stable, so recency survives inside each rank.
   */
  const ordered = useMemo(() => {
    const rank = (v: ShowcaseVideo) => (v.poster ? 2 : 0) + (v.src || v.externalUrl ? 1 : 0);
    return [...videos].sort((a, b) => rank(b) - rank(a));
  }, [videos]);

  const count = ordered.length;
  const go = useCallback(
    (delta: number) => setIndex((i) => (count ? (i + delta + count) % count : 0)),
    [count],
  );

  /**
   * Bring thumbnail `i` into view within the strip only.
   *
   * Deliberately `scrollBy` with a delta measured off getBoundingClientRect,
   * not `scrollIntoView`: scrollIntoView is free to scroll ancestors to bring
   * the target on screen — and since this fires from the autoplay timer below
   * regardless of whether the section is even in the viewport, it was
   * dragging the whole page down to whatever slide autoplay had just
   * advanced to. Same fix, same reasoning, as StoriesRail's scrollToIndex.
   */
  const scrollThumbToIndex = useCallback((i: number) => {
    const strip = stripRef.current;
    const item = strip?.children[i] as HTMLElement | undefined;
    if (!strip || !item) return;
    const delta = item.getBoundingClientRect().left - strip.getBoundingClientRect().left;
    strip.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }
    scrollThumbToIndex(index);
    // A fresh slide always opens on its poster, never mid-playback.
    setVideoPlaying(false);
  }, [index, scrollThumbToIndex]);

  useEffect(() => {
    if (paused || videoPlaying || reducedMotion.current || count < 2) return;
    const id = window.setInterval(() => go(1), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, videoPlaying, go, count]);

  if (!count) return null;
  const active = ordered[Math.min(index, count - 1)];
  const fallbackArt = sectionArtUrl("video", "rgba(255,255,255,.5)", 4);

  const arrow =
    "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border " +
    "border-[rgba(255,255,255,.35)] bg-[rgba(6,38,57,.6)] text-paper backdrop-blur-sm transition-colors " +
    "duration-fast hover:bg-accent sm:h-11 sm:w-11";

  return (
    <section
      className="bg-navy py-8"
      aria-roledescription="carousel"
      aria-label={title}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        // Scoped to focus inside the section, so it never fights the page.
        if (e.key === "ArrowRight") go(isAr ? -1 : 1);
        else if (e.key === "ArrowLeft") go(isAr ? 1 : -1);
        else return;
        e.preventDefault();
      }}
    >
      <div className="mx-auto max-w-container px-6">
        <SectionHeading lang={lang} title={title} href={href} tone="dark" />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] lg:gap-6">
          <div
            className="relative"
            onTouchStart={(e) => {
              touchX.current = e.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              if (touchX.current === null) return;
              const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
              touchX.current = null;
              if (Math.abs(dx) < SWIPE_PX) return;
              // The next clip lives on the inline-end side, so the finger
              // drags toward the start edge to fetch it — mirrored per script.
              go((isAr ? dx > 0 : dx < 0) ? 1 : -1);
            }}
          >
            <VideoPlayer
              key={active.id}
              lang={lang}
              src={active.src}
              externalUrl={active.externalUrl}
              poster={active.poster}
              title={active.title}
              isExclusive={active.isExclusive}
              durationLabel={active.isLive ? undefined : active.durationLabel}
              onPlayingChange={setVideoPlaying}
            />

            {active.isLive ? (
              <span className="absolute end-3 top-3 z-10 flex items-center gap-1.5 rounded-badge bg-badge-live px-2.5 py-1 text-xs font-bold text-paper">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-paper" aria-hidden />
                {t.live}
              </span>
            ) : null}

            {count > 1 ? (
              <>
                <button type="button" aria-label={t.prev} onClick={() => go(-1)} className={`${arrow} start-2 sm:start-3`}>
                  <Chevron lang={lang} dir="back" className="h-4 w-4" />
                </button>
                <button type="button" aria-label={t.next} onClick={() => go(1)} className={`${arrow} end-2 sm:end-3`}>
                  <Chevron lang={lang} className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </div>

          {/* Keyed by video so the synopsis fades in with the poster rather
              than snapping to the new text under the old one. */}
          <div key={active.id} className="flex animate-fade-in flex-col justify-center gap-3">
            {count > 1 ? (
              <div className="tnum text-[12.5px] font-bold text-header-muted" aria-live="polite">
                {index + 1} <span className="opacity-60">{t.of}</span> {count}
              </div>
            ) : null}

            <Link
              href={active.href}
              className={`${isAr ? "font-display-ar" : "font-display-en"} text-[clamp(1.125rem,1rem+0.7vw,1.5rem)] font-extrabold leading-[1.55] text-paper no-underline hover:text-header-muted`}
            >
              {active.title}
            </Link>

            {active.description ? (
              // Plain text here, not <Rich>: this is a 3-line truncated teaser
              // on a dark navy surface, and a colour/highlight token meant for
              // the full white-background description page could land
              // unreadable against it — stripInline keeps the words, drops
              // the markup.
              <p className="m-0 line-clamp-3 text-[14px] leading-[1.85] text-header-muted">{stripInline(active.description)}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-header-muted">
              {active.time ? <span>{active.time}</span> : null}
              {typeof active.views === "number" ? (
                <span className="tnum">{active.views.toLocaleString("en-US")} {t.views}</span>
              ) : null}
              {typeof active.comments === "number" ? (
                <span className="tnum">{active.comments.toLocaleString("en-US")} {t.comments}</span>
              ) : null}
            </div>

            <Link
              href={active.href}
              className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-pill bg-paper px-4 py-2 text-[13px] font-bold text-navy-strong no-underline transition-colors duration-fast hover:bg-accent hover:text-paper"
            >
              {t.watch}
              <Chevron lang={lang} className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {count > 1 ? (
          <div
            ref={stripRef}
            role="tablist"
            aria-label={t.playlist}
            className="scrollbar-none mt-5 flex gap-3 overflow-x-auto pb-1"
          >
            {ordered.map((v, i) => {
              const isActive = i === index;
              return (
                <button
                  key={v.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-active={isActive}
                  onClick={() => setIndex(i)}
                  className={`w-[132px] flex-shrink-0 cursor-pointer text-start transition-opacity duration-med sm:w-[168px] ${
                    isActive ? "opacity-100" : "opacity-55 hover:opacity-90"
                  }`}
                >
                  <span
                    className={`relative block aspect-video overflow-hidden rounded-card bg-navy-2 bg-[length:56px] bg-center bg-no-repeat ${
                      isActive ? "ring-2 ring-paper ring-offset-2 ring-offset-navy" : ""
                    }`}
                    // A video with no cover yet still gets a tile that looks
                    // deliberate: the section's own play mark, not a void.
                    style={v.poster ? undefined : { backgroundImage: fallbackArt ?? undefined }}
                  >
                    {v.poster ? (
                      <Image src={v.poster} alt="" fill sizes="168px" className="object-cover" />
                    ) : null}
                    {v.durationLabel && v.durationLabel !== "—" && !v.isLive ? (
                      <span className="tnum absolute bottom-1 end-1 rounded-badge bg-[rgba(6,38,57,.8)] px-1.5 py-0.5 text-[11px] text-paper">
                        {v.durationLabel}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`mt-2 block line-clamp-2 text-[12.5px] font-bold leading-[1.55] ${
                      isActive ? "text-paper" : "text-header-muted"
                    }`}
                  >
                    {v.title}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
