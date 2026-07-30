import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";
import { clockTime } from "@/lib/format";
import { teamName } from "@/lib/teamNames";
import type { Match, Paginated } from "@/lib/types";
import type { FrontProps } from "./types";

const T = {
  ar: { drop: "أفلت صورة الخبر هنا", results: "النتائج", live: "مباشر", done: "انتهت", soon: "لم تبدأ", empty: "لا أخبار على هذا المكتب بعد." },
  en: { drop: "Drop image here", results: "Results", live: "Live", done: "FT", soon: "Kick-off", empty: "Nothing on this desk yet." },
};

/**
 * «جوّه الجون» — matchday.
 *
 * The masthead is a pitch, drawn in CSS rather than dropped in as a watermark
 * image: touchlines, halfway line, centre circle and both penalty areas, at
 * the real proportions. It is the one section whose subject has a *shape*, and
 * a reader knows what they are looking at before reading a word.
 *
 * The scoreboard sits inside the same green surface because a stadium board is
 * part of the ground, not a widget bolted above the page. Below it the stories
 * run as a striped fixtures table — the list idiom this audience already reads
 * results in — rather than as another grid of photo cards.
 */
export default function SportsFront({ lang, accent, title, tagline, stories, matches }: FrontProps & { matches?: Paginated<Match> | null }) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const accentVar = { "--card-accent": accent } as React.CSSProperties;
  const [lead, ...rest] = stories;
  const fixtures = (matches?.results ?? []).slice(0, 4);

  const statusLabel = (m: Match) =>
    m.status === "live" ? t.live : m.status === "finished" ? t.done : clockTime(m.kickoff_at, lang) || t.soon;

  return (
    <>
      <header className="mb-8 overflow-hidden rounded-card" style={{ backgroundColor: accent }}>
        <div className="relative px-5 py-7 sm:px-8 sm:py-8">
          {/* The pitch. Pure borders, so it costs no request and scales with
              the panel; hidden from assistive tech, which gains nothing here. */}
          <div aria-hidden className="pointer-events-none absolute inset-4 opacity-30 sm:inset-6">
            <div className="absolute inset-0 rounded-[2px] border-2 border-paper" />
            <div className="absolute inset-y-0 start-1/2 w-0 -translate-x-1/2 border-s-2 border-paper" />
            <div className="absolute start-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper sm:h-20 sm:w-20" />
            <div className="absolute inset-y-1/4 start-0 w-[9%] border-2 border-s-0 border-paper" />
            <div className="absolute inset-y-1/4 end-0 w-[9%] border-2 border-e-0 border-paper" />
          </div>
          <div className="relative">
            <h1 className={`${fontDisplay} m-0 text-[clamp(1.875rem,1.3rem+2.4vw,3rem)] font-extrabold leading-[1.15] text-paper`}>{title}</h1>
            {tagline && <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.7] text-paper/85">{tagline}</p>}
          </div>
        </div>

        {/* A lone fixture stays full width. Forcing two columns for one match
            leaves an empty green cell that reads as a missing result. */}
        {fixtures.length > 0 && (
          <div className={`grid gap-px bg-[rgba(255,255,255,.22)] ${fixtures.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {fixtures.map((m) => (
              <div key={m.id} className="px-4 py-3.5" style={{ backgroundColor: accent }}>
                <div className="flex items-center justify-between text-[11.5px] font-bold text-paper/75">
                  <span>{m.round_label || teamName(m.league, lang)}</span>
                  <span className={m.status === "live" ? "rounded-badge bg-badge-live px-1.5 py-0.5 text-paper" : ""}>{statusLabel(m)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className={`${fontDisplay} min-w-0 flex-1 truncate text-[14px] font-extrabold text-paper`}>{teamName(m.home_team, lang)}</span>
                  <span className="tnum rounded-badge bg-[rgba(0,0,0,.28)] px-2.5 py-1 text-[15px] font-extrabold text-paper">{m.score_label}</span>
                  <span className={`${fontDisplay} min-w-0 flex-1 truncate text-end text-[14px] font-extrabold text-paper`}>{teamName(m.away_team, lang)}</span>
                </div>
                {m.venue && <div className="mt-1.5 text-[11.5px] text-paper/65">{teamName(m.venue, lang)}</div>}
              </div>
            ))}
          </div>
        )}
      </header>

      {!lead && <p className="border-y border-line py-10 text-center text-[15px] text-ink-3">{t.empty}</p>}

      {lead && (
        <Link href={lead.href} className="card-link mb-8 block no-underline" style={accentVar}>
          <article className="grid gap-5 sm:grid-cols-[1.2fr_1fr] sm:items-center">
            <div className="relative aspect-[16/10] overflow-hidden rounded-card">
              <CoverImage src={lead.imageSrc} alt={lead.title} placeholder={t.drop} className="absolute inset-0" sizes="(min-width: 768px) 48vw, 100vw" />
            </div>
            <div>
              <h2 className={`${fontDisplay} card-title m-0 text-[clamp(1.25rem,1rem+1.4vw,1.75rem)] font-extrabold leading-[1.45] text-ink`}>{lead.title}</h2>
              {lead.standfirst && <p className="mt-2 text-[15px] leading-[1.75] text-ink-2">{lead.standfirst}</p>}
              {lead.time && <div className="mt-2 text-[13px] font-semibold text-ink-3">{lead.time}</div>}
            </div>
          </article>
        </Link>
      )}

      {rest.length > 0 && (
        <section>
          <h2 className={`${fontDisplay} m-0 border-b-2 pb-2 text-[15px] font-extrabold`} style={{ borderColor: accent, color: accent }}>
            {t.results}
          </h2>
          {/* Striped rows, the shape a results table already has. */}
          <ul className="m-0 list-none p-0">
            {rest.map((s) => (
              <li key={s.id} className="odd:bg-surface">
                <Link href={s.href} className="card-link flex items-center gap-4 px-3 py-3 no-underline" style={accentVar}>
                  {s.imageSrc && (
                    <div className="relative hidden h-[52px] w-[70px] flex-shrink-0 overflow-hidden rounded-[3px] sm:block">
                      <CoverImage src={s.imageSrc} alt="" placeholder="" className="absolute inset-0" sizes="70px" />
                    </div>
                  )}
                  <h3 className={`${fontDisplay} card-title m-0 min-w-0 flex-1 text-[15px] font-extrabold leading-[1.6] text-ink`}>{s.title}</h3>
                  {s.time && <span className="hidden flex-shrink-0 text-[12px] font-semibold text-ink-3 sm:block">{s.time}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
