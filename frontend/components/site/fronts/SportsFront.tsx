import { clockTime } from "@/lib/format";
import { teamName } from "@/lib/teamNames";
import type { Match, Paginated } from "@/lib/types";
import { NewsGridBody } from "./NewsGridFront";
import type { FrontProps } from "./types";

const T = {
  ar: { live: "مباشر", done: "انتهت", soon: "لم تبدأ" },
  en: { live: "Live", done: "FT", soon: "Kick-off" },
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
 * run in the site's one section body (NewsGridBody) — the striped results
 * table this desk used to have was one more list shape the client asked to
 * see gone, and the masthead is where this desk's identity lives.
 */
export default function SportsFront({
  lang,
  accent,
  title,
  tagline,
  stories,
  matches,
  between,
}: FrontProps & { matches?: Paginated<Match> | null; between?: React.ReactNode }) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
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

      <NewsGridBody lang={lang} accent={accent} stories={stories} between={between} />
    </>
  );
}
