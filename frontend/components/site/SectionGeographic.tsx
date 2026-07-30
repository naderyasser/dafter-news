"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";

type Lang = "ar" | "en";

const T = {
  ar: { all: "الآن", empty: "لا توجد أخبار من هذه الدولة بعد.", drop: "أفلت صورة الخبر هنا" },
  en: { all: "Now", empty: "No stories from this country yet.", drop: "Drop image here" },
};

export type GeographicCard = {
  href: string;
  title: string;
  /** Row kicker — the topic («مقابلات» / «سياسة») when the desk set one. */
  kicker?: string;
  /** Fallback kicker and the filter key. */
  country?: string;
  time?: string;
  imageSrc?: string | null;
};

/**
 * The geographic archetype — «الخليج العربي» and «عرب وعالم», built to the
 * client's reference: country tabs on top, the lead's headline set on a
 * solid dark band across the photo, and the rest of the desk gathered into
 * one white panel of thumb-and-kicker rows, like a coverage package.
 *
 * The tabs are built from countries that actually have stories, so a
 * filter never opens onto an empty page; picking one re-leads the package
 * with that country's newest story.
 */
export default function SectionGeographic({
  lang,
  cards,
}: {
  lang: Lang;
  cards: GeographicCard[];
  /** Kept for call-site symmetry with the other archetypes. */
  title?: string;
  href?: string;
  sectionKey?: string | null;
}) {
  const t = T[lang];
  const isAr = lang === "ar";
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const [country, setCountry] = useState<string | null>(null);

  // Only countries with stories, in publication order — no dead tabs.
  const countries = useMemo(() => {
    const seen: string[] = [];
    for (const c of cards) if (c.country && !seen.includes(c.country)) seen.push(c.country);
    return seen;
  }, [cards]);

  const visible = country ? cards.filter((c) => c.country === country) : cards;
  const [lead, ...rest] = visible;

  const tabClass = (active: boolean) =>
    `flex-shrink-0 rounded-pill border px-4 py-1.5 text-[13px] font-bold transition-colors duration-fast ${
      active ? "text-paper" : "border-line bg-paper text-ink hover:border-accent"
    }`;
  const activeFill = { backgroundColor: "var(--rule-b)", borderColor: "var(--rule-b)" };

  return (
    <>
      {countries.length > 1 && (
        <div className="scrollbar-none mb-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button onClick={() => setCountry(null)} className={tabClass(country === null)} style={country === null ? activeFill : undefined}>
            {t.all}
          </button>
          {countries.map((c) => (
            <button key={c} onClick={() => setCountry(c)} className={tabClass(country === c)} style={country === c ? activeFill : undefined}>
              {c}
            </button>
          ))}
        </div>
      )}

      {!visible.length ? (
        <p className="py-10 text-center text-[15px] text-ink-3">{t.empty}</p>
      ) : (
        <>
          {/* The lead: headline set on a solid dark band over the photo. */}
          <Link href={lead.href} className="card-link block overflow-hidden rounded-card no-underline">
            <div className="relative">
              <div className="relative aspect-[16/9]">
                <CoverImage src={lead.imageSrc} alt={lead.title} placeholder={t.drop} className="absolute inset-0" sizes="(min-width: 1024px) 60vw, 100vw" />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-[rgba(18,21,26,.9)] px-5 py-4">
                <h2 className={`${fontDisplay} m-0 text-[clamp(1.25rem,1rem+1.3vw,1.75rem)] font-extrabold leading-[1.45] text-paper`}>
                  {lead.title}
                </h2>
              </div>
            </div>
          </Link>

          {/* The package: the rest of the desk in one white panel. */}
          {rest.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-card border border-line bg-paper">
              {rest.map((c, i) => (
                <Link
                  key={c.href + i}
                  href={c.href}
                  className={`card-link flex items-start gap-4 p-4 no-underline ${i === rest.length - 1 ? "" : "border-b border-line"}`}
                >
                  <div className="relative w-[104px] flex-shrink-0 overflow-hidden rounded-lg sm:w-[120px]">
                    <div className="relative aspect-[4/3]">
                      <CoverImage src={c.imageSrc} alt={c.title} placeholder={t.drop} className="absolute inset-0" sizes="120px" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    {(c.kicker || c.country) && (
                      <div className="mb-1 text-[12px] font-bold text-ink-3">{c.kicker || c.country}</div>
                    )}
                    <h3 className={`${fontDisplay} card-title m-0 text-[15.5px] font-bold leading-[1.55] text-ink`}>{c.title}</h3>
                    {c.time && <div className="mt-1.5 text-caption text-ink-3">{c.time}</div>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
