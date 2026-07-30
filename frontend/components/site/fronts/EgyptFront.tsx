import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";
import { formatDate } from "@/lib/format";
import { sectionArtUrl } from "@/lib/sections";
import type { FrontProps } from "./types";

const T = {
  ar: { drop: "أفلت صورة الخبر هنا", more: "المزيد من مصر", empty: "لا أخبار على هذا المكتب بعد." },
  en: { drop: "Drop image here", more: "More from Egypt", empty: "Nothing on this desk yet." },
};

/** The section flag: a heavy rule over a hairline, the printed-paper device. */
function Flag({ accent }: { accent: string }) {
  return (
    <span aria-hidden className="block">
      <span className="block h-[3px]" style={{ backgroundColor: accent }} />
      <span className="mt-[3px] block h-px" style={{ backgroundColor: accent, opacity: 0.45 }} />
    </span>
  );
}

/**
 * «شؤون مصر» — the home desk, built for breadth.
 *
 * This desk carries a metro extension, a cabinet decision and a weather
 * warning on the same morning, and its job is to show a reader the whole
 * country at once. So the front is the two-deck front page of a printed
 * daily: one dominant lead with two stories beside it, then a run of
 * headline-only text columns underneath.
 *
 * The text run is the point. Photographs are what make a page look full while
 * showing four stories; dropping them below the fold puts eight more
 * headlines in the same space, which is what breadth actually costs.
 *
 * The governorate rail this desk obviously wants is not here on purpose —
 * nothing in the article table records a governorate, so the chips would have
 * been decoration with no data under them.
 */
export default function EgyptFront({ lang, accent, sectionKey, title, tagline, stories }: FrontProps) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const [lead, ...others] = stories;
  const shoulder = others.slice(0, 2);
  const run = others.slice(2);
  const art = sectionArtUrl(sectionKey, accent, 5);
  const today = formatDate(new Date().toISOString(), lang);
  const accentVar = { "--card-accent": accent } as React.CSSProperties;

  return (
    <>
      <header className="relative mb-7">
        <Flag accent={accent} />
        {art && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-2 end-0 hidden w-[26%] bg-contain bg-center bg-no-repeat opacity-[.09] sm:block"
            style={{ backgroundImage: art }}
          />
        )}
        <div className="relative flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1 pb-3 pt-4">
          <h1 className={`${fontDisplay} m-0 text-[clamp(1.75rem,1.2rem+2.2vw,2.75rem)] font-extrabold leading-[1.2] text-ink`}>{title}</h1>
          <span className="tnum text-[13px] font-semibold text-ink-3">{today}</span>
        </div>
        {tagline && <p className="relative m-0 max-w-[54ch] px-1 pb-4 text-[15px] leading-[1.75] text-ink-2">{tagline}</p>}
        <Flag accent={accent} />
      </header>

      {!lead && <p className="border-y border-line py-10 text-center text-[15px] text-ink-3">{t.empty}</p>}

      {lead && (
        <div className="mb-8 grid gap-7 md:grid-cols-[1.55fr_1fr]">
          {/* The lead sets its headline under the photograph rather than over
              it — the politics desk overlays, so this one does not. */}
          <Link href={lead.href} className="card-link block no-underline" style={accentVar}>
            <article>
              <div className="relative aspect-[16/9] overflow-hidden rounded-card">
                <CoverImage src={lead.imageSrc} alt={lead.title} placeholder={t.drop} className="absolute inset-0" sizes="(min-width: 768px) 55vw, 100vw" />
              </div>
              <h2 className={`${fontDisplay} card-title mt-4 text-[clamp(1.25rem,.95rem+1.6vw,1.875rem)] font-extrabold leading-[1.4] text-ink`}>
                {lead.title}
              </h2>
              {lead.standfirst && <p className="mt-2 text-[15px] leading-[1.75] text-ink-2">{lead.standfirst}</p>}
              {lead.time && <div className="mt-2.5 text-[13px] font-semibold text-ink-3">{lead.time}</div>}
            </article>
          </Link>

          {shoulder.length > 0 && (
            <div className="md:border-s md:border-line md:ps-7">
              {shoulder.map((s) => (
                <Link
                  key={s.id}
                  href={s.href}
                  className="card-link flex gap-4 border-b border-line py-4 no-underline first:pt-0 last:border-b-0 md:block"
                  style={accentVar}
                >
                  <div className="relative aspect-[4/3] w-[110px] flex-shrink-0 overflow-hidden rounded-card md:w-full">
                    <CoverImage src={s.imageSrc} alt={s.title} placeholder={t.drop} className="absolute inset-0" sizes="(min-width: 768px) 300px, 110px" />
                  </div>
                  <div className="min-w-0">
                    <h3 className={`${fontDisplay} card-title m-0 text-[16px] font-extrabold leading-[1.55] text-ink md:mt-3`}>{s.title}</h3>
                    {s.time && <div className="mt-1.5 text-[12px] font-semibold text-ink-3">{s.time}</div>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {run.length > 0 && (
        <section>
          <Flag accent={accent} />
          <h2 className={`${fontDisplay} m-0 px-1 pb-2 pt-3 text-[15px] font-extrabold text-ink`}>{t.more}</h2>
          <Flag accent={accent} />
          {/* Real text columns, so the run reads as a printed page rather than
              as another row of cards. break-inside keeps a headline whole. */}
          <div className="mt-5 gap-x-7 sm:columns-2 lg:columns-3">
            {run.map((s) => (
              <Link
                key={s.id}
                href={s.href}
                className="card-link mb-5 block break-inside-avoid border-t border-line pt-3 no-underline"
                style={accentVar}
              >
                <h3 className={`${fontDisplay} card-title m-0 text-[15px] font-extrabold leading-[1.6] text-ink`}>{s.title}</h3>
                {s.time && <div className="mt-1.5 text-[12px] font-semibold text-ink-3">{s.time}</div>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
