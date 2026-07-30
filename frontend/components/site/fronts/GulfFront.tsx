import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";
import { toEasternNumerals } from "@/lib/format";
import { sectionArtUrl } from "@/lib/sections";
import type { FrontProps, FrontStory } from "./types";

const T = {
  ar: { drop: "أفلت صورة الخبر هنا", rest: "من الخليج", empty: "لا أخبار على هذا المكتب بعد.", jump: "عواصم الخليج" },
  en: { drop: "Drop image here", rest: "Around the Gulf", empty: "Nothing on this desk yet.", jump: "Gulf capitals" },
};

/** A country's anchor id — Arabic names are fine in a fragment once encoded. */
const anchorId = (country: string) => `desk-${encodeURIComponent(country)}`;

/**
 * «الخليج العربي» — the country board.
 *
 * This is the one desk where the story already carries the thing that should
 * organise the page: every story here is filed against a country. So the front
 * is a board of capitals — a jump strip across the top, then one column per
 * country, each with its own newest story and the rest listed under it.
 *
 * A reader who came for Kuwait can see Kuwait's column without scanning a
 * mixed feed for the word. The jump strip is plain anchor links rather than a
 * filter: it needs no JavaScript, it survives with the page half-loaded, and
 * nothing is ever hidden from a reader who just scrolls.
 *
 * Stories filed without a country are not forced into one — they collect
 * under «من الخليج» at the foot of the board.
 */
export default function GulfFront({ lang, accent, sectionKey, title, tagline, stories }: FrontProps) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  // The mark sits on the teal panel, so it is stroked in white rather than in
  // the section's own colour — a teal dhow on teal is an invisible dhow.
  const artOnDark = sectionArtUrl(sectionKey, "rgba(255,255,255,.95)", 5);
  const accentVar = { "--card-accent": accent } as React.CSSProperties;

  const [lead, ...others] = stories;

  // Countries in the order the desk filed them, so the board reorders itself
  // as the news does rather than sitting in a hardcoded GCC list.
  const byCountry = new Map<string, FrontStory[]>();
  const unplaced: FrontStory[] = [];
  for (const s of others) {
    if (!s.country) unplaced.push(s);
    else byCountry.set(s.country, [...(byCountry.get(s.country) ?? []), s]);
  }
  const columns = [...byCountry.entries()];

  return (
    <>
      {/* Masthead and country strip are one object: on a desk organised BY
          country, the capitals belong to the nameplate, not to a row of chips
          floating under it. Reversed out of the desk's own teal, with the
          dhow behind — the only front whose navigation is part of its flag. */}
      <header className="relative mb-8 overflow-hidden rounded-card" style={{ backgroundColor: accent }}>
        {artOnDark && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-[-15%] end-[-1rem] hidden w-[30%] bg-contain bg-center bg-no-repeat opacity-[.18] sm:block"
            style={{ backgroundImage: artOnDark }}
          />
        )}
        <div className="relative px-5 pb-6 pt-6 sm:px-7">
          <h1 className={`${fontDisplay} m-0 text-[clamp(1.75rem,1.2rem+2.2vw,2.75rem)] font-extrabold leading-[1.2] text-paper`}>{title}</h1>
          {tagline && <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.7] text-paper/85">{tagline}</p>}
        </div>
        {columns.length > 0 && (
          <nav aria-label={t.jump} className="relative flex flex-wrap gap-x-1 gap-y-0 bg-[rgba(0,0,0,.18)] px-3 py-1.5 sm:px-5">
            {columns.map(([country, items]) => (
              <a
                key={country}
                href={`#${anchorId(country)}`}
                className="rounded-[3px] px-2.5 py-1.5 text-[13px] font-bold text-paper no-underline transition-colors duration-fast hover:bg-[rgba(255,255,255,.16)] focus-visible:bg-[rgba(255,255,255,.16)]"
              >
                {country}
                <span className="tnum ms-1.5 text-paper/60">{isAr ? toEasternNumerals(items.length) : items.length}</span>
              </a>
            ))}
          </nav>
        )}
      </header>

      {!lead && <p className="border-y border-line py-10 text-center text-[15px] text-ink-3">{t.empty}</p>}

      {lead && (
        <Link href={lead.href} className="card-link mb-9 block no-underline" style={accentVar}>
          <article className="grid gap-5 sm:grid-cols-[1.2fr_1fr] sm:items-center">
            <div className="relative aspect-[16/10] overflow-hidden rounded-card">
              <CoverImage src={lead.imageSrc} alt={lead.title} placeholder={t.drop} className="absolute inset-0" sizes="(min-width: 768px) 45vw, 100vw" />
            </div>
            <div>
              {lead.country && (
                <span className="mb-2 inline-block rounded-badge px-2 py-1 text-[12px] font-extrabold text-paper" style={{ backgroundColor: accent }}>
                  {lead.country}
                </span>
              )}
              <h2 className={`${fontDisplay} card-title m-0 text-[clamp(1.25rem,1rem+1.4vw,1.75rem)] font-extrabold leading-[1.45] text-ink`}>
                {lead.title}
              </h2>
              {lead.standfirst && <p className="mt-2 text-[15px] leading-[1.75] text-ink-2">{lead.standfirst}</p>}
              {lead.time && <div className="mt-2 text-[13px] font-semibold text-ink-3">{lead.time}</div>}
            </div>
          </article>
        </Link>
      )}

      {columns.length > 0 && (
        <div className="grid gap-x-6 gap-y-8 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          {columns.map(([country, items]) => {
            const [first, ...more] = items;
            return (
              <section key={country} id={anchorId(country)} className="scroll-mt-24">
                <h2 className="m-0 mb-3 border-b-2 pb-2 text-[14px] font-extrabold" style={{ borderColor: accent, color: accent }}>
                  {country}
                </h2>
                <Link href={first.href} className="card-link block no-underline" style={accentVar}>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-card">
                    <CoverImage src={first.imageSrc} alt={first.title} placeholder={t.drop} className="absolute inset-0" sizes="(min-width: 768px) 240px, 100vw" />
                  </div>
                  <h3 className={`${fontDisplay} card-title mt-2.5 text-[15px] font-extrabold leading-[1.6] text-ink`}>{first.title}</h3>
                  {first.time && <div className="mt-1 text-[12px] font-semibold text-ink-3">{first.time}</div>}
                </Link>
                {more.map((s) => (
                  <Link key={s.id} href={s.href} className="card-link mt-3 block border-t border-line pt-3 no-underline" style={accentVar}>
                    <h3 className={`${fontDisplay} card-title m-0 text-[14px] font-extrabold leading-[1.6] text-ink`}>{s.title}</h3>
                  </Link>
                ))}
              </section>
            );
          })}
        </div>
      )}

      {unplaced.length > 0 && (
        <section className="mt-10">
          <h2 className="m-0 mb-3 border-b-2 pb-2 text-[14px] font-extrabold" style={{ borderColor: accent, color: accent }}>
            {t.rest}
          </h2>
          {unplaced.map((s) => (
            <Link key={s.id} href={s.href} className="card-link block border-b border-line py-3 no-underline last:border-b-0" style={accentVar}>
              <h3 className={`${fontDisplay} card-title m-0 text-[15px] font-extrabold leading-[1.6] text-ink`}>{s.title}</h3>
              {s.time && <div className="mt-1 text-[12px] font-semibold text-ink-3">{s.time}</div>}
            </Link>
          ))}
        </section>
      )}
    </>
  );
}
