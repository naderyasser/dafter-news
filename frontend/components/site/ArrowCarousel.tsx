"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
}: {
  lang: "ar" | "en";
  children: React.ReactNode;
  itemClassName?: string;
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
    "flex h-9 w-9 items-center justify-center rounded-full border border-line bg-paper text-[16px] text-ink transition-colors duration-fast disabled:cursor-default disabled:opacity-35 enabled:hover:border-brand enabled:hover:bg-brand enabled:hover:text-paper";

  return (
    <div className="relative">
      <div className="mb-3 flex justify-end gap-2">
        <button type="button" aria-label={isAr ? "السابق" : "Previous"} onClick={() => nudge(-1)} disabled={atStart} className={arrowBase}>
          <span className={isAr ? "" : "-scale-x-100"}>›</span>
        </button>
        <button type="button" aria-label={isAr ? "التالي" : "Next"} onClick={() => nudge(1)} disabled={atEnd} className={arrowBase}>
          <span className={isAr ? "" : "-scale-x-100"}>‹</span>
        </button>
      </div>

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
