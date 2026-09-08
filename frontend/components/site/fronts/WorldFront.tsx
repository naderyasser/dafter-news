"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import CoverImage from "@/components/ui/CoverImage";
import ListThumb from "@/components/ui/ListThumb";
import { sectionArtUrl } from "@/lib/sections";
import type { FrontProps } from "./types";

const T = {
  ar: { drop: "أفلت صورة الخبر هنا", empty: "لا أخبار على هذا المكتب بعد.", all: "الآن" },
  en: { drop: "Drop image here", empty: "Nothing on this desk yet.", all: "Now" },
};

/**
 * «عرب وعالم» — the wire, read the way a wire agency's own app reads it.
 *
 * Client forwarded Al Jazeera's mobile page and asked for this desk to match
 * it: a lead photo with the headline set straight over it beside a coloured
 * rule, a strip of datelines to page through underneath, then a plain feed —
 * thumbnail and headline where a story has a photo, a subject line standing
 * in for it where it doesn't.
 *
 * The dateline strip is a real filter, not a decorative row of chips: every
 * story here already carries the country it is filed under (see WorldFront's
 * old wire design), so paging the feed by country costs a click handler and
 * no extra data.
 */
export default function WorldFront({ lang, accent, sectionKey, title, tagline, stories }: FrontProps) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const art = sectionArtUrl(sectionKey, accent, 5);

  const [lead, ...rest] = stories;

  // Datelines in the order the desk filed them, deduplicated — the strip a
  // reader actually gets, not a hardcoded list of capitals.
  const countries = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const s of rest) {
      if (s.country && !seen.has(s.country)) {
        seen.add(s.country);
        list.push(s.country);
      }
    }
    return list;
  }, [rest]);

  const [active, setActive] = useState<string | null>(null);
  const feed = active ? rest.filter((s) => s.country === active) : rest;

  const Tab = ({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 whitespace-nowrap border-b-2 px-0.5 pb-2.5 text-[14px] font-extrabold transition-colors ${
        isActive ? "" : "border-transparent text-ink-3 hover:text-ink-2"
      }`}
      style={isActive ? { borderColor: accent, color: accent } : undefined}
    >
      {label}
    </button>
  );

  return (
    <>
      <header className="relative mb-5 flex items-center gap-2.5">
        {art && <span aria-hidden className="h-8 w-8 flex-shrink-0 bg-contain bg-center bg-no-repeat opacity-80" style={{ backgroundImage: art }} />}
        <div>
          <h1 className={`${fontDisplay} m-0 text-[clamp(1.5rem,1.15rem+1.6vw,2.25rem)] font-extrabold leading-[1.2]`} style={{ color: accent }}>
            {title}
          </h1>
          {tagline && <p className="mt-1 max-w-[54ch] text-[13.5px] leading-[1.7] text-ink-2">{tagline}</p>}
        </div>
      </header>

      {!lead && <p className="border-y border-line py-10 text-center text-[15px] text-ink-3">{t.empty}</p>}

      {/* The lead: headline set straight over the photo beside a solid rule
          in the desk's colour, the way the reference page's own splash reads. */}
      {lead && (
        <Link href={lead.href} className="group relative mb-6 block overflow-hidden rounded-card no-underline">
          <div className="relative aspect-[4/3] sm:aspect-[21/9]">
            <CoverImage src={lead.imageSrc} alt={lead.title} placeholder={t.drop} className="absolute inset-0" sizes="(min-width: 1024px) 900px, 100vw" />
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.88),rgba(0,0,0,.12)_55%,transparent_75%)]" />
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-stretch gap-3.5 p-5">
            <span aria-hidden className="w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: accent }} />
            <h2 className={`${fontDisplay} m-0 text-[clamp(1.3rem,1rem+1.6vw,1.875rem)] font-extrabold leading-[1.35] text-white`}>{lead.title}</h2>
          </div>
        </Link>
      )}

      {countries.length > 0 && (
        <nav aria-label={t.all} className="mb-6 flex gap-5 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Tab label={t.all} isActive={active === null} onClick={() => setActive(null)} />
          {countries.map((c) => (
            <Tab key={c} label={c} isActive={active === c} onClick={() => setActive(c)} />
          ))}
        </nav>
      )}

      <div className="flex flex-col">
        {feed.map((s) => (
          <Link key={s.id} href={s.href} className="flex items-center gap-3.5 border-b border-line py-4 no-underline last:border-b-0">
            <div className="min-w-0 flex-1">
              {!s.imageSrc && s.subject && <div className="mb-1 text-[12px] font-semibold text-ink-3">{s.subject}</div>}
              <h3 className={`${fontDisplay} card-title m-0 text-[15px] font-extrabold leading-[1.6] text-ink`}>{s.title}</h3>
            </div>
            {s.imageSrc ? <ListThumb src={s.imageSrc} size="sm" /> : null}
          </Link>
        ))}
        {feed.length === 0 && active && <p className="py-8 text-center text-[14px] text-ink-3">{t.empty}</p>}
      </div>
    </>
  );
}
