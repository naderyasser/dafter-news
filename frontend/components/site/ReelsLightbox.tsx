"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import Chevron from "@/components/ui/Chevron";
import { ReelPoster, type ReelCard, type ReelCopy } from "@/components/site/ReelPoster";
import { useSwipe } from "@/lib/useSwipe";
import { YOUTUBE_IFRAME_ALLOW, youtubeEmbedSrc, youtubeWatchUrl } from "@/lib/youtube";

/**
 * The «حصل إيه؟» rail's cards plus the lightbox player they open.
 *
 * The rail itself is a native horizontal scroller — a trackpad, a finger and
 * the Tab key all move it with no script — so this component owns exactly
 * one piece of state: which reel, if any, is open in the player. Until a
 * card is pressed nothing but the posters is on the page: no iframe, no
 * dialog, no listener.
 */
export default function ReelsLightbox({ lang, reels, t }: { lang: "ar" | "en"; reels: ReelCard[]; t: ReelCopy }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <ul
        aria-label={t.rail}
        className="scrollbar-none -mx-6 m-0 flex gap-4 overflow-x-auto snap-x snap-mandatory list-none px-6 pb-1"
      >
        {reels.map((reel, i) => (
          <li key={reel.id} className="shrink-0 snap-start">
            <ReelPoster lang={lang} reel={reel} t={t} tone="light" onOpen={() => setOpen(i)} />
          </li>
        ))}
      </ul>
      {open !== null && (
        <ReelLightbox lang={lang} reels={reels} t={t} index={open} onChange={setOpen} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

/**
 * The player overlay: one 9:16 frame in the middle of a dark backdrop, the
 * previous/next reel a press or a swipe away, the way every shorts player a
 * reader has already met behaves.
 *
 * Rendered through a portal on document.body: the rail sits inside the
 * page's stacking and overflow contexts, and a fixed overlay nested in it
 * would be clipped by the rail's own `overflow-x`.
 *
 * Exactly one iframe is ever mounted — the reel being watched — and it is
 * keyed by video id, so moving to the next reel unmounts the old player
 * outright rather than leaving its audio running behind the new one. Closing
 * unmounts it too, for the same reason.
 */
export function ReelLightbox({
  lang,
  reels,
  t,
  index,
  onChange,
  onClose,
}: {
  lang: "ar" | "en";
  reels: ReelCard[];
  t: ReelCopy;
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
}) {
  const isAr = lang === "ar";
  const reel = reels[index];
  const hasPrev = index > 0;
  const hasNext = index < reels.length - 1;

  const go = useCallback(
    (delta: -1 | 1) => {
      const next = index + delta;
      if (next < 0 || next >= reels.length) return;
      onChange(next);
    },
    [index, reels.length, onChange],
  );

  // Arrow keys follow reading direction, so «التالي» is always the key that
  // points forward on screen rather than a fixed ArrowRight.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key === "ArrowLeft") return go(isAr ? 1 : -1);
      if (e.key === "ArrowRight") return go(isAr ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, isAr]);

  // The page behind must not scroll while the player is up.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const swipe = useSwipe((dir) => go(dir === "next" ? 1 : -1), isAr);

  if (!reel || typeof document === "undefined") return null;

  const arrowClass =
    "flex h-11 w-11 items-center justify-center rounded-full bg-brand text-paper shadow-2 transition-colors hover:bg-brand-strong disabled:cursor-default disabled:opacity-30";

  return createPortal(
    <div
      dir={isAr ? "rtl" : "ltr"}
      lang={lang}
      role="dialog"
      aria-modal="true"
      aria-label={t.player}
      className={`fixed inset-0 z-[120] flex items-center justify-center bg-board-stage/90 backdrop-blur-sm ${
        isAr ? "font-body-ar" : "font-body-en"
      }`}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t.close}
        className="absolute end-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-brand text-[20px] text-paper shadow-2 hover:bg-brand-strong"
      >
        ✕
      </button>

      {/* Stop the backdrop's own close from firing for anything inside the
          player column. */}
      <div
        className="animate-fade-in flex w-full max-w-[560px] flex-col items-center gap-4 px-4"
        onClick={(e) => e.stopPropagation()}
        {...swipe}
      >
        <div className="flex w-full items-center justify-center gap-4">
          <button type="button" onClick={() => go(-1)} disabled={!hasPrev} aria-label={t.prev} className={`${arrowClass} max-sm:hidden`}>
            <Chevron lang={lang} dir="back" className="h-5 w-5" />
          </button>

          {/* The frame sizes ITSELF from the viewport's height (see .reel-stage
              in globals.css) so the title and actions under it stay above the
              fold on a phone. */}
          <div className="reel-stage relative overflow-hidden rounded-2xl bg-board-stage shadow-2xl">
            <iframe
              key={reel.youtubeId}
              src={youtubeEmbedSrc(reel.youtubeId, { autoplay: true })}
              title={reel.title}
              allow={YOUTUBE_IFRAME_ALLOW}
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>

          <button type="button" onClick={() => go(1)} disabled={!hasNext} aria-label={t.next} className={`${arrowClass} max-sm:hidden`}>
            <Chevron lang={lang} dir="forward" className="h-5 w-5" />
          </button>
        </div>

        <h2 className={`${isAr ? "font-display-ar" : "font-display-en"} m-0 line-clamp-2 max-w-[380px] text-center text-[15px] font-bold leading-[1.5] text-paper`}>
          {reel.title}
        </h2>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] font-semibold">
          <Link href={reel.href} className="text-paper underline decoration-white/30 underline-offset-2 hover:decoration-paper">
            {t.openPage}
          </Link>
          <a
            href={youtubeWatchUrl(reel.youtubeId)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-header-muted no-underline hover:text-paper"
          >
            {t.onYoutube} ↗
          </a>
          <span className="text-header-muted" dir="ltr">
            {index + 1} / {reels.length}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
