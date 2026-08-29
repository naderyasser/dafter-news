"use client";

import { useRef } from "react";

/**
 * Finger swipe for the paged carousels.
 *
 * The scrolling rails (ArrowCarousel, OpinionCarousel, StoriesRail,
 * VideoShowcase) get swipe for free — they are `overflow-x-auto`, so the
 * browser does it. The PAGED ones do not: they keep only the current page in
 * the DOM and move by index, so there is nothing for a finger to drag and a
 * reader on a phone was left with two 36px arrows as the only way through.
 *
 * Direction is reported as `next`/`prev`, never left/right, so callers do not
 * have to think about writing direction. The mapping is done once here: in
 * RTL, dragging the content leftwards (a negative dx) reveals what comes
 * NEXT, which is the opposite of LTR.
 *
 * Deliberately passive listeners via React's own onTouch* props and no
 * preventDefault: the gesture must never fight vertical page scrolling. A
 * swipe only counts when it is decisively horizontal (see the ratio test),
 * so a slightly-diagonal scroll down the page still scrolls the page.
 */
export function useSwipe(onSwipe: (dir: "next" | "prev") => void, isRtl: boolean) {
  const start = useRef<{ x: number; y: number } | null>(null);

  /** Below this, it is a tap or a tremor, not a swipe. */
  const MIN_DISTANCE = 45;
  /** Horizontal travel must beat vertical by this much to count. */
  const DOMINANCE = 1.4;

  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const from = start.current;
      start.current = null;
      if (!from) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - from.x;
      const dy = t.clientY - from.y;
      if (Math.abs(dx) < MIN_DISTANCE) return;
      if (Math.abs(dx) < Math.abs(dy) * DOMINANCE) return;
      // dx < 0 is a drag towards the left edge of the screen.
      //
      // In LTR the next item sits to the RIGHT, so bringing it into view
      // means pushing the content left — a leftward drag is "next". In RTL
      // the next item sits to the LEFT (matching ArrowCarousel, which scrolls
      // by a NEGATIVE offset to advance in Arabic), so the sense inverts.
      const draggedLeft = dx < 0;
      onSwipe(draggedLeft !== isRtl ? "next" : "prev");
    },
  };
}
