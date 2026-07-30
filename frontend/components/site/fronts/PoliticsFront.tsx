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
      <header className="relative mb-8 overflow-hidden border-t-[5px] bg-paper px-5 pb-6 pt-5 sm:px-7" style={{ borderColor: accent }}>
        {art && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-[-18%] end-[-2.5rem] hidden w-[30%] bg-contain bg-center bg-no-repeat opacity-[.07] sm:block"
            style={{ backgroundImage: art }}
          />
        )}
        <div className="relative flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className={`${fontDisplay} m-0 text-[clamp(2rem,1.3rem+2.8vw,3.25rem)] font-extrabold leading-[1.15]`} style={{ color: accent }}>
            {title}
          </h1>
          <span className="tnum text-[13px] font-semibold text-ink-3">{today}</span>
        </div>
        {tagline && <p className="relative mt-2.5 max-w-[54ch] text-[15px] leading-[1.75] text-ink-2">{tagline}</p>}
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
              <h2 className={`${fontDisplay} m-0 text-[clamp(1.375rem,1rem+2.1vw,2.375rem)] font-extrabold leading-[1.35] text-paper`}>
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
