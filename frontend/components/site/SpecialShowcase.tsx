"use client";

import { useState } from "react";

import Link from "next/link";

import Chevron from "@/components/ui/Chevron";
import CoverImage from "@/components/ui/CoverImage";
import type { SpecialFileCard } from "@/components/site/SpecialFilesBlock";

type Lang = "ar" | "en";

const T = {
  ar: { label: "أحدث الملفات", prev: "الملف السابق", next: "الملف التالي", goTo: "الملف", drop: "أفلت صورة الملف هنا" },
  en: { label: "Latest files", prev: "Previous file", next: "Next file", goTo: "File", drop: "Drop cover here" },
};

/**
 * «ملف خاص» section page, to the client's cinema reference: one poster
 * commands the stage, its neighbours peek dimmed from the wings, a red
 * dot-strip counts the shelf. Investigations are covers here, not cards —
 * the desk publishes a handful of long files, so the page sells ONE at a
 * time instead of laying twenty tiles nobody dwells on.
 *
 * The wings are buttons (bring that file to the stage); only the staged
 * poster is a link. Both flank orders follow the reading direction.
 */
export default function SpecialShowcase({ lang, items }: { lang: Lang; items: SpecialFileCard[] }) {
  const [index, setIndex] = useState(0);
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const n = items.length;

  if (!n) return null;

  const go = (d: 1 | -1) => setIndex((i) => (i + d + n) % n);
  /** 0 = staged, ±1 = wings, null = backstage. */
  const pos = (i: number): number | null => {
    const diff = (i - index + n) % n;
    if (diff === 0) return 0;
    if (diff === 1) return 1;
    if (diff === n - 1) return -1;
    return null;
  };
  // The "next" wing sits toward the reading end: left in RTL, right in LTR.
  const sign = isAr ? -1 : 1;

  const arrowClass =
    "flex h-10 w-10 items-center justify-center rounded-full bg-brand text-paper transition-colors duration-fast hover:bg-brand-strong";

  return (
    <section className="overflow-hidden rounded-card bg-navy-strong px-5 pb-6 pt-5 sm:px-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className={`${fontDisplay} m-0 text-[15px] font-extrabold text-paper`}>{t.label}</h2>
        {n > 1 && (
          <button type="button" aria-label={t.prev} onClick={() => go(-1)} className={arrowClass}>
            <Chevron lang={lang} dir="back" className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="relative mx-auto h-[420px] w-full max-w-[520px] sm:h-[480px]">
        {items.map((f, i) => {
          const p = pos(i);
          if (p === null) return null;
          const staged = p === 0;
          const style: React.CSSProperties = staged
            ? { left: "50%", transform: "translateX(-50%) scale(1)", zIndex: 20, opacity: 1 }
            : { left: "50%", transform: `translateX(calc(-50% + ${p * 62 * sign}%)) scale(.78)`, zIndex: 10, opacity: 0.35 };
          const poster = (
            <span className="relative block overflow-hidden rounded-card ring-1 ring-paper/20">
              <span className="relative block aspect-[3/4]">
                <CoverImage src={f.imageSrc} alt={f.title} placeholder={t.drop} className="absolute inset-0" sizes="380px" />
              </span>
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(4,14,23,.92)] via-transparent to-transparent" />
              <span className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4 text-start">
                <span className={`${fontDisplay} block text-[16px] font-extrabold leading-[1.5] text-paper`}>{f.title}</span>
                {staged && f.authorName && (
                  <span className="flex items-center gap-2">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-gold bg-[rgba(6,38,57,.7)] text-[12px] font-extrabold text-gold">
                      {f.authorAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.authorAvatar} alt={f.authorName} className="h-full w-full object-cover" />
                      ) : (
                        f.authorInitial || "؟"
                      )}
                    </span>
                    <span className="text-[12px] font-bold text-paper/90">{f.authorName}</span>
                  </span>
                )}
              </span>
            </span>
          );
          return (
            <div key={f.href} className="absolute inset-y-2 w-[64%] transition-all duration-500 sm:w-[58%]" style={style}>
              {staged ? (
                <Link href={f.href} className="block no-underline">
                  {poster}
                </Link>
              ) : (
                <button type="button" onClick={() => setIndex(i)} aria-label={`${t.goTo}: ${f.title}`} className="block w-full">
                  {poster}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {n > 1 && (
        <div className="mt-5 flex items-center justify-center gap-3">
          <button type="button" aria-label={t.prev} onClick={() => go(-1)} className="text-paper/60 hover:text-paper">
            <Chevron lang={lang} dir="back" className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5">
            {items.map((f, i) => (
              <button
                key={f.href}
                type="button"
                aria-label={`${t.goTo} ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-pill transition-all duration-fast ${i === index ? "w-6 bg-brand" : "w-1.5 bg-paper/30 hover:bg-paper/60"}`}
              />
            ))}
          </div>
          <button type="button" aria-label={t.next} onClick={() => go(1)} className="text-paper/60 hover:text-paper">
            <Chevron lang={lang} className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  );
}
