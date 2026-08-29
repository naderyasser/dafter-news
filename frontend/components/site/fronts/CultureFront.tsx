"use client";

import Link from "next/link";
import { useState } from "react";

import CoverImage from "@/components/ui/CoverImage";
import { formatDate, toDisplayNumerals } from "@/lib/format";
import { sectionArtUrl } from "@/lib/sections";
import type { FrontProps } from "./types";

const T = {
  ar: { drop: "أفلت صورة العمل هنا", empty: "لا موضوعات على هذا المكتب بعد.", prev: "السابق", next: "التالي" },
  en: { drop: "Drop image here", empty: "Nothing on this desk yet.", prev: "Previous", next: "Next" },
};

function Chevron({ dir, className = "" }: { dir: "left" | "right"; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

/**
 * «ثقافة وفن» — the story reel.
 *
 * The client forwarded a WhatsApp Status ad — one work at a time, full-bleed
 * photo, a coloured caption bar with paging arrows either side of the title —
 * and asked for exactly that in place of the old gallery-wall hang. So this
 * front now pages through the desk's stories one at a time instead of laying
 * them all out at once; the caption bar reads in the desk's own accent rather
 * than the ad's blue, which is the one thing every front on the site already
 * agrees on.
 */
export default function CultureFront({ lang, accent, sectionKey, title, tagline, stories }: FrontProps) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const art = sectionArtUrl(sectionKey, accent, 5);
  const [index, setIndex] = useState(0);
  const active = stories[index];

  // Physical left/right, not reading-direction start/end — these are paging
  // buttons on a photo viewer, not text controls, and the client's reference
  // image put "previous" on the left regardless of script.
  const go = (delta: number) => setIndex((i) => (i + delta + stories.length) % stories.length);

  return (
    <>
      {/* Masthead: the introduction panel at a gallery entrance — centred
          inside a hairline frame, with the palette mark set small above the
          name rather than ghosted behind it. */}
      <header className="relative mx-auto mb-10 max-w-[620px] border px-6 py-7 text-center" style={{ borderColor: accent }}>
        {art && (
          <span
            aria-hidden
            className="mx-auto mb-3 block h-[42px] w-[70px] bg-contain bg-center bg-no-repeat opacity-75"
            style={{ backgroundImage: art }}
          />
        )}
        <h1 className={`${fontDisplay} m-0 text-[clamp(1.625rem,1.2rem+1.8vw,2.5rem)] font-extrabold leading-[1.25]`} style={{ color: accent }}>
          {title}
        </h1>
        {tagline && <p className="mx-auto mt-2.5 max-w-[46ch] text-[14.5px] leading-[1.8] text-ink-2">{tagline}</p>}
      </header>

      {!active && <p className="border-y border-line py-10 text-center text-[15px] text-ink-3">{t.empty}</p>}

      {active && (
        <div className="mx-auto mb-10 max-w-[420px] overflow-hidden rounded-[26px] bg-paper shadow-2 ring-1 ring-line">
          <Link href={active.href} className="block no-underline">
            <span className="relative block aspect-[4/3]">
              <CoverImage src={active.imageSrc} alt={active.title} placeholder={t.drop} className="absolute inset-0" sizes="(min-width: 640px) 420px, 100vw" />
            </span>
          </Link>

          <div className="relative flex items-center gap-3 px-3 py-5" style={{ backgroundColor: accent }}>
            {stories.length > 1 && (
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label={t.prev}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
              >
                <Chevron dir="left" className="h-5 w-5" />
              </button>
            )}

            <Link href={active.href} className="flex-1 text-center no-underline">
              <h2 className={`${fontDisplay} m-0 text-[16px] font-extrabold leading-[1.5] text-white`}>{active.title}</h2>
              <p className="mt-1.5 text-[11.5px] font-semibold text-white/70">
                {active.authorName && <span>{active.authorName}</span>}
                {active.authorName && (active.iso || active.time) && <span aria-hidden> · </span>}
                {formatDate(active.iso, lang) || active.time}
              </p>
            </Link>

            {stories.length > 1 && (
              <button
                type="button"
                onClick={() => go(1)}
                aria-label={t.next}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
              >
                <Chevron dir="right" className="h-5 w-5" />
              </button>
            )}
          </div>

          {stories.length > 1 && (
            <div className="tnum flex justify-center gap-1 border-t border-line bg-paper py-2 text-[11px] font-semibold text-ink-3">
              {isAr ? toDisplayNumerals(index + 1) : index + 1} / {isAr ? toDisplayNumerals(stories.length) : stories.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}
