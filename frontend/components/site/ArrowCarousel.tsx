"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Chevron from "@/components/ui/Chevron";

/**
 * Horizontal rail with explicit prev/next arrow buttons (the عكاظ pattern).
 *
 * The track scrolls natively, so touch and trackpad still work and RTL
 * reverses for free; the arrows just nudge scrollLeft by one viewport. They
 * disable at each end rather than wrapping, so the control always tells the
 * truth about whether there is more to see.
 */
export default function ArrowCarousel({
  lang,
  children,
  itemClassName = "w-[280px]",
  overlayArrows = false,
}: {
  lang: "ar" | "en";
  children: React.ReactNode;
  itemClassName?: string;
  /**
   * «ثقافة وفن»'s own look, on the client's reference: large filled circles
   * sitting directly on the photo at each edge, instead of a pair of small
   * outlined ones in a row above the rail. Only offered for full-bleed photo
   * cards (the `hero` ArticleCard variant this section already uses) — a
   * card with its own text block below the image (تقنية's `standard` cards)
   * would land these dead centre across the image-to-caption seam rather
   * than on the photo, so that carousel keeps the row-above style instead.
   */
  overlayArrows?: boolean;
}) {
  const isAr = lang === "ar";
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    // In RTL scrollLeft counts negative (or from the right) depending on the
    // engine — normalise to a distance-from-start so the logic is direction
    // agnostic.
    const max = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft);
    setAtStart(pos <= 1);
    setAtEnd(pos >= max - 1);
  }, []);

  useEffect(() => {
    sync();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [sync]);

  const nudge = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.85 * dir * (isAr ? -1 : 1);
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  const arrowBase =
    "flex h-9 w-9 items-center justify-center rounded-full border border-line bg-paper text-[16px] text-ink shadow-1 transition-all duration-fast disabled:cursor-default disabled:opacity-35 disabled:shadow-none enabled:hover:scale-110 enabled:hover:border-brand enabled:hover:bg-brand enabled:hover:text-paper enabled:hover:shadow-2 enabled:active:scale-95";

  // Solid accent-blue circles, big enough to read as a real control against
  // a busy photo — the site's own blue half of the identity, not the red
  // that's reserved for urgency badges. `disabled:invisible` rather than the
  // row-above arrows' `disabled:opacity-35`: a dimmed circle sitting directly
  // on top of a photo still reads as "press me, weakly", where the row-above
  // arrows dim against plain page background and that reading never comes up.
  const overlayArrowBase =
    "absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-paper shadow-2 ring-1 ring-inset ring-white/20 transition-all duration-fast disabled:invisible enabled:hover:scale-110 enabled:hover:bg-accent-strong enabled:active:scale-95";

  return (
    <div className="relative">
      {!overlayArrows && (
        <div className="mb-3 flex justify-end gap-2">
          <button type="button" aria-label={isAr ? "السابق" : "Previous"} onClick={() => nudge(-1)} disabled={atStart} className={arrowBase}>
            <Chevron lang={lang} dir="back" className="h-4 w-4" />
          </button>
          <button type="button" aria-label={isAr ? "التالي" : "Next"} onClick={() => nudge(1)} disabled={atEnd} className={arrowBase}>
            <Chevron lang={lang} className="h-4 w-4" />
          </button>
        </div>
      )}

      {overlayArrows && (
        <>
          <button
            type="button"
            aria-label={isAr ? "السابق" : "Previous"}
            onClick={() => nudge(-1)}
            disabled={atStart}
            className={`${overlayArrowBase} start-3`}
          >
            <Chevron lang={lang} dir="back" className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label={isAr ? "التالي" : "Next"}
            onClick={() => nudge(1)}
            disabled={atEnd}
            className={`${overlayArrowBase} end-3`}
          >
            <Chevron lang={lang} className="h-5 w-5" />
          </button>
        </>
      )}

      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {Array.isArray(children)
          ? children.map((child, i) => (
              <div key={i} className={`flex-shrink-0 snap-start ${itemClassName}`}>
                {child}
              </div>
            ))
          : children}
      </div>
    </div>
  );
}
