"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Wraps the sticky masthead+nav so it slides away on scroll-down and back on
 * scroll-up — on a phone that band is real screen real estate, and the
 * client wanted it back once a reader has committed to scrolling rather
 * than pinned for the whole session.
 *
 * A client component only for this: SiteHeader itself stays a server
 * component (it fetches sections/breaking news/prayer times), and that data
 * still renders on the server as this wrapper's `children` — only the
 * show/hide behaviour needs the browser.
 *
 * Threshold, not the raw delta: the header only starts hiding past 80px, so
 * the small back-and-forth scroll a reader does right at the top of the
 * page (checking the hero, nudging back up) doesn't flicker it in and out.
 */
export default function StickyHeader({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setHidden(y > lastY.current && y > 80);
        lastY.current = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`sticky top-0 z-50 transition-transform duration-med motion-reduce:transition-none ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      {children}
    </div>
  );
}
