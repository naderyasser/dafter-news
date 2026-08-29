import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";
import { clockTime, dayBucket, formatDate } from "@/lib/format";
import { sectionArtUrl } from "@/lib/sections";
import type { FrontProps, FrontStory } from "./types";

const T = {
  ar: { drop: "أفلت صورة الخبر هنا", record: "السجل", empty: "لا مواقف مسجّلة بعد على هذا المكتب." },
  en: { drop: "Drop image here", record: "The record", empty: "Nothing on the record from this desk yet." },
};

/**
 * «سياسة» — the record.
 *
 * A politics desk does not deal in a grid of equally-weighted photo cards. It
 * deals in dated positions: who said what, when, and what moved because of it.
 * So the front is a chronicle — one lead stated at full width, then every
 * other story hung on a dated spine with the clock time it was filed at,
 * broken by day rules.
 *
 * The spine is the whole idea, so everything around it is deliberately quiet:
 * no tabs, no pagination chrome, no second colour. The thumbnails are small
 * and square and sit at the far edge, because on this desk the headline is
 * the story and the photograph is corroboration.
 *
 * It has to survive a thin day. This desk currently holds a single unpublished
 * story, so an empty spine renders nothing at all rather than an empty rail,
 * and an undated story files under «الأحدث» rather than being given a date it
 * does not have.
 */
export default function PoliticsFront({ lang, accent, sectionKey, title, tagline, stories }: FrontProps) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const [lead, ...rest] = stories;
  const art = sectionArtUrl(sectionKey, accent, 5);
  const today = formatDate(new Date().toISOString(), lang);

  // Consecutive stories from the same day share one rule. The API already
  // returns them newest-first, so a single pass is enough — no sort, and the
  // groups come out in the order a reader scans them.
  const groups: { label: string; items: FrontStory[] }[] = [];
  for (const s of rest) {
    const label = dayBucket(s.iso, lang);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(s);
    else groups.push({ label, items: [s] });
  }

  return (
    <>
      {/* Masthead: the name at full size on paper, then the desk's own colour
          as a solid dateline band under it. The band is what makes this a
          record rather than a page — it carries the day the way the top of a
          printed page does, and no other desk opens on one. */}
      <header className="relative mb-8">
        <div className="relative overflow-hidden px-1 pb-4 pt-1">
          {art && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-[-30%] end-[-1.5rem] hidden w-[26%] bg-contain bg-center bg-no-repeat opacity-[.08] sm:block"
              style={{ backgroundImage: art }}
            />
          )}
          <h1 className={`${fontDisplay} relative m-0 text-[clamp(2.125rem,1.35rem+3vw,3.5rem)] font-extrabold leading-[1.1]`} style={{ color: accent }}>
            {title}
          </h1>
          {tagline && <p className="relative mt-2.5 max-w-[54ch] text-[15px] leading-[1.75] text-ink-2">{tagline}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5" style={{ backgroundColor: accent }}>
          <span className={`${fontDisplay} text-[13px] font-extrabold text-paper`}>{t.record}</span>
          <span className="tnum text-[13px] font-semibold text-paper/80">{today}</span>
        </div>
      </header>

      {!lead && <p className="border-y border-line py-10 text-center text-[15px] text-ink-3">{t.empty}</p>}

      {/* The lead is stated, not previewed: the photograph is pushed into the
          desk's own colour so the headline is the only thing at full strength. */}
      {lead && (
        <Link
          href={lead.href}
          className="card-link mb-10 block no-underline"
          style={{ "--card-accent": accent } as React.CSSProperties}
        >
          <article className="relative overflow-hidden rounded-card">
            <div className="relative aspect-[16/9] sm:aspect-[16/7]">
              <CoverImage
                src={lead.imageSrc}
                alt={lead.title}
                placeholder={t.drop}
                className="absolute inset-0 grayscale contrast-[1.08]"
                sizes="(min-width: 1024px) 62vw, 100vw"
              />
            </div>
            <div aria-hidden className="absolute inset-0 opacity-[.72] mix-blend-multiply" style={{ backgroundColor: accent }} />
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.82),rgba(0,0,0,.15)_58%,transparent)]" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
              {lead.subject && (
                <span className="mb-2.5 inline-block bg-paper px-2.5 py-1 text-[12px] font-extrabold" style={{ color: accent }}>
                  {lead.subject}
                </span>
              )}
              <h2 className={`${fontDisplay} m-0 line-clamp-3 text-[clamp(1.125rem,0.9rem+1.5vw,2.375rem)] font-extrabold leading-[1.25] text-paper`}>
                {lead.title}
              </h2>
              {lead.time && <div className="tnum mt-2.5 text-[13px] font-semibold text-paper/80">{lead.time}</div>}
            </div>
          </article>
        </Link>
      )}

      {groups.map((g) => (
        <section key={g.label} className="mb-2">
          <h2 className="m-0 flex items-center gap-3 py-3">
            {/* No letter-spacing anywhere on this page: tracking pulls Arabic
                letters out of their joins, so a "refined" tracked label just
                renders as broken script. Weight and colour carry it instead. */}
            <span className="text-[13px] font-extrabold" style={{ color: accent }}>
              {g.label}
            </span>
            <span aria-hidden className="h-px flex-1" style={{ backgroundColor: accent, opacity: 0.25 }} />
          </h2>

          {/* The rail: one hairline down the inline start, a node per story.
              Logical properties throughout, so it mirrors in LTR untouched. */}
          <ol className="relative m-0 list-none p-0">
            <span aria-hidden className="absolute inset-y-0 start-[5px] w-px" style={{ backgroundColor: accent, opacity: 0.2 }} />
            {g.items.map((s) => (
              <li key={s.id} className="relative border-b border-line last:border-b-0">
                <Link
                  href={s.href}
                  className="card-link flex items-start gap-4 py-4 ps-7 no-underline"
                  style={{ "--card-accent": accent } as React.CSSProperties}
                >
                  <span
                    aria-hidden
                    className="absolute start-0 top-[1.55rem] h-[11px] w-[11px] rounded-full border-2 bg-paper"
                    style={{ borderColor: accent }}
                  />
                  <time className="tnum mt-0.5 w-[3.5rem] flex-shrink-0 text-[13px] font-bold tabular-nums text-ink-3">
                    {clockTime(s.iso, lang)}
                  </time>
                  <div className="min-w-0 flex-1">
                    <h3 className={`${fontDisplay} card-title m-0 text-[16px] font-extrabold leading-[1.6] text-ink sm:text-[17px]`}>
                      {s.title}
                    </h3>
                    {s.standfirst && <p className="mt-1.5 line-clamp-2 text-[14px] leading-[1.7] text-ink-2">{s.standfirst}</p>}
                  </div>
                  {s.imageSrc && (
                    <div className="relative hidden h-[64px] w-[96px] flex-shrink-0 overflow-hidden rounded-[3px] sm:block">
                      <CoverImage src={s.imageSrc} alt="" placeholder="" className="absolute inset-0" sizes="96px" />
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </>
  );
}
