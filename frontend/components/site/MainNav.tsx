"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { sectionColor } from "@/lib/sections";

export type NavItem = { key: string; href: string; label: string };

/**
 * The main section bar, on ONE line at desktop widths.
 *
 * Thirteen Arabic section names do not fit the container, and the two
 * previous answers were both bad in their own way: `overflow-x-auto` pushed
 * the tail of the list off the end of a bar with no affordance to scroll it,
 * and `flex-wrap` (what shipped) grew the sticky chrome to a second 42px row
 * — 190px of pinned header before a reader reaches a headline.
 *
 * So: measure, then move whatever does not fit into a «المزيد ⌄» menu.
 *
 * The server renders EVERY item, and the trim happens on the client after
 * measuring. That ordering matters — a crawler (and a reader with JS off)
 * still sees all thirteen section links in the markup, so the overflow menu
 * costs nothing in crawlable navigation.
 *
 * Phones keep the swipeable single row they already had: a touchscreen has
 * the scroll affordance built in, so an overflow menu there would be a
 * second way to do what the finger already does.
 */
export default function MainNav({ items, active }: { items: NavItem[]; active?: string }) {
  const barRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const moreRef = useRef<HTMLDivElement>(null);
  const widths = useRef<number[]>([]);
  // Starts at "everything fits" so the server markup and the first client
  // paint agree; the effect below corrects it before the browser paints.
  const [visible, setVisible] = useState(items.length);
  const [open, setOpen] = useState(false);
  const [measured, setMeasured] = useState(false);

  const measure = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return;
    // Item widths are stable (the labels never change), so they are captured
    // once from the full render and reused for every later resize.
    if (!widths.current.length) {
      widths.current = itemRefs.current.map((el) => (el ? el.getBoundingClientRect().width : 0));
      if (widths.current.some((w) => w === 0)) return;
    }
    const GAP = 24;
    const MORE_W = 86; // «المزيد ⌄» plus its gap — reserved before fitting.
    const avail = bar.clientWidth;

    let used = 0;
    let fit = 0;
    for (let i = 0; i < widths.current.length; i++) {
      const next = used + widths.current[i] + (i ? GAP : 0);
      if (next > avail) break;
      used = next;
      fit++;
    }
    // If the tail doesn't fit, the «المزيد» control needs room of its own.
    if (fit < widths.current.length) {
      while (fit > 0 && used + GAP + MORE_W > avail) {
        used -= widths.current[fit - 1] + (fit > 1 ? GAP : 0);
        fit--;
      }
    }
    setVisible(fit);
    setMeasured(true);
  }, []);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (barRef.current) ro.observe(barRef.current);
    return () => ro.disconnect();
  }, [measure]);

  // Dismiss the menu the two ways a menu is expected to dismiss.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const linkClass = (isActive: boolean) =>
    `flex h-8 flex-shrink-0 items-center whitespace-nowrap border-b-[3px] px-1 text-[13.5px] no-underline sm:h-9 ${
      isActive ? "font-bold" : "border-transparent font-semibold text-ink hover:text-accent"
    }`;

  const overflow = measured ? items.slice(visible) : [];
  const shown = measured ? items.slice(0, visible) : items;

  return (
    <nav className="border-b border-line bg-paper shadow-1">
      <div className="mx-auto flex max-w-container items-stretch px-6">
        {/* Phones: one swipeable row. Desktop: measured, never wrapping. */}
        <div
          ref={barRef}
          className="scrollbar-none flex min-w-0 flex-1 items-stretch gap-x-6 overflow-x-auto sm:overflow-x-hidden"
        >
          {shown.map((item, i) => {
            const isActive = item.key === active;
            const color = sectionColor(item.key === "home" ? undefined : item.key);
            return (
              <Link
                key={item.key}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                href={item.href}
                className={linkClass(isActive)}
                style={isActive ? { borderColor: color, color } : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {overflow.length > 0 && (
          <div ref={moreRef} className="relative flex flex-shrink-0 items-stretch ps-6">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-haspopup="true"
              className="flex h-8 items-center gap-1 whitespace-nowrap border-b-[3px] border-transparent px-1 text-[13.5px] font-semibold text-ink no-underline hover:text-accent sm:h-9"
            >
              المزيد
              <span aria-hidden className={`text-[10px] transition-transform duration-fast ${open ? "rotate-180" : ""}`}>
                ▾
              </span>
            </button>
            {open && (
              <div className="absolute end-0 top-full z-50 mt-px min-w-[190px] rounded-card border border-line bg-paper py-1.5 shadow-2">
                {overflow.map((item) => {
                  const isActive = item.key === active;
                  const color = sectionColor(item.key === "home" ? undefined : item.key);
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="block px-4 py-2 text-[13.5px] font-semibold text-ink no-underline hover:bg-surface"
                      style={isActive ? { color } : undefined}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
