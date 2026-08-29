import Link from "next/link";

import ClockIcon from "@/components/ui/ClockIcon";
import CoverImage from "@/components/ui/CoverImage";
import Chevron from "@/components/ui/Chevron";
import type { SectionBlockCard } from "@/components/site/SectionBlock";
import { clockTime } from "@/lib/format";
import { teamName } from "@/lib/teamNames";
import type { Match } from "@/lib/types";

const T = {
  ar: {
    drop: "أفلت صورة الخبر هنا",
    more: "كل الأخبار",
    board: "لوحة النتائج",
    live: "مباشر",
    done: "انتهت",
    soon: "لم تبدأ",
    allResults: "كل المباريات",
  },
  en: {
    drop: "Drop image here",
    more: "All stories",
    board: "Scoreboard",
    live: "Live",
    done: "FT",
    soon: "Kick-off",
    allResults: "All fixtures",
  },
};

/**
 * One row of the scoreboard.
 *
 * Score and kickoff both sit in the same fixed-width column so the numbers
 * line up down the board the way they do on a real one — the column is what
 * makes it scannable, not the individual row. `tnum` keeps the digits from
 * shifting width between 1 and 4.
 */
function ScoreRow({ match, lang }: { match: Match; lang: "ar" | "en" }) {
  const t = T[lang];
  const live = match.status === "live";
  const finished = match.status === "finished";
  const status = live ? t.live : finished ? t.done : clockTime(match.kickoff_at, lang) || t.soon;

  return (
    <div className="flex items-center gap-3 border-t border-pitch-line px-4 py-3 first:border-t-0">
      <div className="min-w-0 flex-1 text-[13.5px] font-bold leading-[1.5] text-paper">
        <div className="truncate">{teamName(match.home_team, lang)}</div>
        <div className="truncate">{teamName(match.away_team, lang)}</div>
      </div>
      <div className="tnum shrink-0 text-center text-[15px] font-extrabold text-paper">
        {finished || live ? (
          <>
            <div>{match.home_score ?? "—"}</div>
            <div>{match.away_score ?? "—"}</div>
          </>
        ) : (
          <div className="text-[13px] font-bold text-paper/70">—</div>
        )}
      </div>
      <div className="w-[54px] shrink-0 text-end">
        {live ? (
          <span className="inline-flex items-center gap-1 rounded-badge bg-badge-live px-1.5 py-0.5 text-[10.5px] font-extrabold text-paper">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-paper" />
            {t.live}
          </span>
        ) : (
          <span className="tnum text-[11px] font-semibold text-pitch-bright">{status}</span>
        )}
      </div>
    </div>
  );
}

/**
 * «جوّه الجون» on the home page — the sports desk's own surface.
 *
 * Every other block on this page is cards on paper. This one is the pitch:
 * the section the client called their flagship, and the one whose subject
 * actually has a shape. The layout is the shape of matchday too — one story
 * played big, the rest of the desk beside it, and the scoreboard where a
 * scoreboard goes, rather than a fourth grid of identical squares.
 *
 * It deliberately echoes the section front (fronts/SportsFront) — same
 * pitch, same board — so the block reads as a trailer for that page instead
 * of a different design wearing the same name.
 *
 * Results fold into the band rather than sitting under it as a separate
 * rail: a stadium board is part of the ground, not a widget bolted below it.
 * Nothing here renders when the desk has no stories, and the board simply
 * drops out when the feed has no fixtures, leaving the stories full width.
 */
export default function SportsBlock({
  lang,
  title,
  href,
  cards,
  matches = [],
}: {
  lang: "ar" | "en";
  title: string;
  href: string;
  cards: SectionBlockCard[];
  matches?: Match[];
}) {
  if (!cards.length) return null;

  const t = T[lang];
  const isAr = lang === "ar";
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const [lead, ...rest] = cards;
  const fixtures = matches.slice(0, 4);
  const secondary = rest.slice(0, 4);

  return (
    <section className="pitch-surface relative overflow-hidden">
      {/* The markings sit on their own layer so the content above them keeps
          full contrast; `inset` insets them off the band's edges the way a
          pitch sits inside its ground. */}
      <div aria-hidden className="pitch-markings pointer-events-none absolute inset-6 hidden sm:block" />

      <div className="relative mx-auto max-w-container px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className={`${fontDisplay} m-0 text-[clamp(1.375rem,1.1rem+1vw,1.875rem)] font-extrabold text-paper`}>
            <span className="border-b-4 border-pitch-bright pb-1.5">{title}</span>
          </h2>
          <Link
            href={href}
            className="inline-flex items-center gap-1.5 rounded-pill border border-pitch-line px-4 py-1.5 text-[13px] font-bold text-paper no-underline transition-colors duration-fast hover:border-pitch-bright hover:text-pitch-bright"
          >
            {t.more}
            <Chevron lang={lang} className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className={`grid gap-6 ${fixtures.length ? "lg:grid-cols-[1.7fr_1fr]" : ""}`}>
          <div className="min-w-0">
            {/* The lead, played big: photo to the edges, headline set into it. */}
            <Link href={lead.href} className="card-link group relative block overflow-hidden rounded-card no-underline">
              <div className="relative aspect-[16/9]">
                <CoverImage
                  src={lead.imageSrc}
                  alt={lead.title}
                  placeholder={t.drop}
                  className="absolute inset-0"
                  sizes="(min-width: 1024px) 760px, 100vw"
                />
                {/* Carries further up the frame than the site's other photo
                    scrims: sports photography is floodlit turf and pitch-side
                    advertising — bright, saturated green — and a headline in
                    white over that needs the tint to reach the whole text
                    block, not just fade in behind its last line. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(7,53,31,.96)] via-[rgba(7,53,31,.62)] to-[rgba(7,53,31,.08)]"
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5">
                {lead.section && (
                  <span className="text-[12px] font-extrabold text-pitch-bright">{lead.section}</span>
                )}
                <h3
                  className={`${fontDisplay} m-0 mt-1.5 line-clamp-3 text-[clamp(1.125rem,0.95rem+0.9vw,1.5rem)] font-extrabold leading-[1.35] text-paper`}
                >
                  {lead.title}
                </h3>
                {lead.time && (
                  <div className="tnum mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-paper/85">
                    <ClockIcon />
                    {lead.time}
                  </div>
                )}
              </div>
            </Link>

            {/* The rest of the desk — numbered, because a sports reader reads
                a running order, and because it distinguishes these rows from
                the timestamped lists everywhere else on the page. */}
            {secondary.length > 0 && (
              <ol className="mt-5 grid gap-x-6 sm:grid-cols-2">
                {secondary.map((c, i) => (
                  <li key={c.href + i} className="border-t border-pitch-line">
                    <Link href={c.href} className="card-link flex items-start gap-3 py-3.5 no-underline">
                      <span className={`${fontDisplay} tnum shrink-0 text-[19px] font-extrabold leading-none text-pitch-bright/70`}>
                        {i + 2}
                      </span>
                      <span className="min-w-0">
                        <span className="block line-clamp-2 text-[14.5px] font-bold leading-[1.55] text-paper">
                          {c.title}
                        </span>
                        {c.time && <span className="tnum mt-1 block text-[12px] text-paper/60">{c.time}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {fixtures.length > 0 && (
            <aside className="min-w-0">
              <div className="overflow-hidden rounded-card border border-pitch-line bg-[rgba(3,24,14,.55)]">
                <div className="flex items-center justify-between gap-3 border-b border-pitch-line px-4 py-3">
                  <span className={`${fontDisplay} text-[14px] font-extrabold text-paper`}>{t.board}</span>
                  <span className="h-2 w-2 rounded-full bg-pitch-bright" aria-hidden />
                </div>
                {fixtures.map((m) => (
                  <ScoreRow key={m.id} match={m} lang={lang} />
                ))}
                <Link
                  href={href}
                  className="block border-t border-pitch-line px-4 py-3 text-center text-[12.5px] font-bold text-pitch-bright no-underline transition-colors duration-fast hover:bg-[rgba(74,222,128,.1)]"
                >
                  {t.allResults}
                </Link>
              </div>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}
