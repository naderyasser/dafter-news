"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { API_URL } from "@/lib/api";
import type { TickerPayload } from "@/lib/types";

const AR_LABELS: Record<string, string> = {
  USD: "دولار/جنيه",
  EUR: "يورو/جنيه",
  GBP: "إسترليني/جنيه",
  SAR: "ريال سعودي/جنيه",
  // AED and KWD are in the provider's TRACKED list but were missing here, so
  // the Arabic bar fell through to the bare ISO code for both.
  AED: "درهم إماراتي/جنيه",
  KWD: "دينار كويتي/جنيه",
};

// GoldKarat.label and WeatherCity.label are single-language columns holding
// Arabic, so the English bar rendered "عيار 21" verbatim. Map at the view
// layer — same approach AR_LABELS already takes for currency codes — rather
// than adding a second column to a table the dashboard edits by hand.
const EN_GOLD: Record<string, string> = {
  "عيار 24": "Gold 24K",
  "عيار 21": "Gold 21K",
  "عيار 18": "Gold 18K",
  "جنيه ذهب": "Gold pound",
};

const EN_CITY: Record<string, string> = {
  cairo: "Cairo",
  alex: "Alexandria",
  luxor: "Luxor",
  aswan: "Aswan",
};

/** Fallback ordering when the TickerModule table hasn't been set up. */
const DEFAULT_ORDER = ["currencies", "gold", "weather"];

function Chip({ up, children }: { up: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`tnum flex items-center gap-0.5 whitespace-nowrap rounded-pill px-1.5 py-0.5 text-xs font-bold ${
        up ? "bg-up-tint text-up" : "bg-down-tint text-down"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Sticky bottom bar on every public page (brief §6/§5 — every page reserves
 * 52px at the bottom for this). The whole bar is one link to /markets.
 *
 * The rates scroll continuously as a ticker tape. The track holds two
 * identical copies of the row and translates by exactly 50%, so the loop
 * restarts on a frame where copy B sits precisely where copy A began —
 * that's what makes it read as endless rather than as a jump. Motion pauses
 * on hover so a reader can actually take a number in.
 *
 * The strip is also a real scroll container (overflow-x-auto), so a reader
 * can page through it by hand — a finger-drag on mobile scrolls it natively;
 * a mouse drag gets the same via the pointer handlers below, since a mouse
 * doesn't get that for free. Either kind of manual scroll pauses the
 * automatic animation for a moment (the `scroll` event fires for both), so
 * the two motions don't fight over the same pixels.
 */
export default function MarketsTicker({ lang, data: initial }: { lang: "ar" | "en"; data: TickerPayload }) {
  const isAr = lang === "ar";
  const fontBody = isAr ? "font-body-ar" : "font-body-en";
  const [data, setData] = useState(initial);

  // Manual scroll (touch drag or the mouse-drag handlers below) pauses the
  // automatic tape for a moment rather than fighting it — cleared a beat
  // after the last scroll event, so it resumes on its own once let go of.
  const [interacting, setInteracting] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScroll = () => {
    setInteracting(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setInteracting(false), 1200);
  };
  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

  // Mouse drag-to-scroll: touch already scrolls this natively (it's a real
  // overflow-x-auto container), but a mouse doesn't get that for free.
  // `drag.moved` also tells the click handler below whether the mouse-up that
  // ends a drag was a scroll or an actual tap meant to follow the link.
  const dragRef = useRef<{ startX: number; startScroll: number; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    dragRef.current = { startX: e.clientX, startScroll: e.currentTarget.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerType !== "mouse") return;
    const delta = e.clientX - drag.startX;
    if (Math.abs(delta) > 4) drag.moved = true;
    e.currentTarget.scrollLeft = drag.startScroll - delta;
  };
  const endDrag = () => {
    // The click that a mouse-up dispatches fires after this, so the flag it
    // reads has to survive one more tick before clearing.
    setTimeout(() => { dragRef.current = null; }, 0);
  };
  const onLinkClick = (e: React.MouseEvent) => {
    if (dragRef.current?.moved) e.preventDefault();
  };

  // `modules` was fetched and then ignored, so the dashboard's on/off switches
  // and its ordering changed nothing out here. Drive both from it now: only
  // active modules render, and they render in the order the newsroom set.
  //
  // With no modules configured at all there's no curation to honour, so show
  // everything rather than blanking the bar — an empty table is "nobody has
  // set this up", not "hide the ticker".
  const configured = data.modules.filter((m) => m.active).sort((a, b) => a.order - b.order);
  const active: { key: string; refresh_seconds: number }[] = data.modules.length
    ? configured
    : DEFAULT_ORDER.map((key) => ({ key, refresh_seconds: 60 }));

  // One timer at the shortest interval any active module asks for. Per-module
  // timers would mean several overlapping requests to a single combined
  // endpoint that returns all of them anyway.
  const refreshMs = Math.max(15, Math.min(...active.map((m) => m.refresh_seconds), 3600)) * 1000;

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`${API_URL}/ticker/`, { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as TickerPayload;
        if (!cancelled) setData(next);
      } catch {
        // Keep the last good numbers rather than emptying the bar.
      }
    };
    const id = setInterval(poll, refreshMs);
    document.addEventListener("visibilitychange", poll);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [refreshMs]);

  const weather = data.weather;

  const byKey: Record<string, React.ReactNode[]> = {
    currencies: data.currencies.map((c) => (
      <div key={`c-${c.code}`} className="flex flex-shrink-0 items-center gap-2">
        <span className="whitespace-nowrap text-[13px] text-ink-3">{isAr ? AR_LABELS[c.code] ?? c.code : `${c.code}/EGP`}</span>
        <span className="tnum whitespace-nowrap text-[14px] font-bold text-ink">{c.sell}</span>
        <Chip up={c.is_up}>
          {c.is_up ? "▲" : "▼"} {c.change_pct}%
        </Chip>
      </div>
    )),
    gold: data.gold.map((g) => (
      <div key={`g-${g.label}`} className="flex flex-shrink-0 items-center gap-2">
        <span className="whitespace-nowrap text-[13px] text-ink-3">{isAr ? `ذهب ${g.label}` : EN_GOLD[g.label] ?? g.label}</span>
        <span className="tnum whitespace-nowrap text-[14px] font-bold text-ink">{g.price}</span>
        <Chip up={g.is_up}>
          {g.is_up ? "▲" : "▼"} {g.change_pct}%
        </Chip>
      </div>
    )),
    weather: weather
      ? [
          <div key="w" className="flex flex-shrink-0 items-center gap-2">
            <span className="whitespace-nowrap text-[13px] text-ink-3">
              {isAr ? weather.label : EN_CITY[weather.key] ?? weather.key} {weather.icon}
            </span>
            <span className="tnum whitespace-nowrap text-[14px] font-bold text-ink">{weather.temp}°</span>
          </div>,
        ]
      : [],
  };

  // Modules with no data of their own yet (index, oil) simply contribute
  // nothing — they stay switchable in the dashboard for when they do.
  const items = active.flatMap((m) => byKey[m.key] ?? []);

  const strip = (copy: string) => (
    <div className="flex flex-shrink-0 items-center gap-7 pe-7" aria-hidden={copy === "b"}>
      {items.map((item, i) => (
        <div key={`${copy}-${i}`} className="flex items-center gap-7">
          {item}
          <span className="h-4 w-px flex-shrink-0 bg-line" />
        </div>
      ))}
    </div>
  );

  return (
    <Link
      href={isAr ? "/markets" : "/en"}
      aria-label={isAr ? "الأسواق" : "Markets"}
      onClick={onLinkClick}
      className={`${fontBody} fixed inset-x-0 bottom-0 z-40 block h-[52px] overflow-hidden border-t border-line bg-paper shadow-sticky`}
    >
      <div
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        className="mx-auto flex h-full max-w-container cursor-grab items-center overflow-x-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.length ? (
          <div
            className={`flex min-w-full items-center ${
              isAr ? "animate-ticker-rtl" : "animate-ticker-ltr"
            } motion-reduce:animate-none hover:[animation-play-state:paused] ${interacting ? "[animation-play-state:paused]" : ""}`}
          >
            {strip("a")}
            {strip("b")}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
