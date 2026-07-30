import SectionHeading from "@/components/site/SectionHeading";
import type { Match } from "@/lib/types";
import { arabicName } from "@/lib/teamNames";

const T = {
  ar: { heading: "نتائج ومباريات", more: "جوّه الجون", live: "مباشر", finished: "انتهت", upcoming: "قادمة" },
  en: { heading: "Results & fixtures", more: "Sports", live: "Live", finished: "FT", upcoming: "Upcoming" },
};

/**
 * Results and fixtures for جوّه الجون.
 *
 * Played matches lead — a reader checking the football rail wants the score
 * first — and upcoming fixtures follow with kickoff times instead of a
 * score, so an unplayed match never reads as a goalless draw.
 */
function kickoffLabel(iso: string | null, lang: "ar" | "en") {
  if (!iso) return "";
  const d = new Date(iso);
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function MatchCard({ match, lang }: { match: Match; lang: "ar" | "en" }) {
  const finished = match.status === "finished";
  const live = match.status === "live";
  const t = T[lang];
  // TheSportsDB's strings are already English; the mapping is for Arabic only.
  const name = (v?: string | null) => (lang === "ar" ? arabicName(v) : v ?? "");

  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-line bg-paper p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11.5px] font-semibold text-ink-3">{lang === "ar" ? match.round_label || arabicName(match.league) : name(match.league) || match.round_label}</span>
        {live ? (
          <span className="flex flex-shrink-0 items-center gap-1.5 rounded-badge bg-badge-live px-2 py-0.5 text-[11px] font-bold text-paper">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-paper" />
            {t.live}
          </span>
        ) : (
          <span className="flex-shrink-0 text-[11.5px] text-ink-3">{finished ? t.finished : t.upcoming}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">{name(match.home_team)}</span>
        <span
          className={`tnum flex-shrink-0 rounded px-2.5 py-1 text-[15px] font-extrabold ${
            finished || live ? "bg-navy text-paper" : "bg-surface-2 text-ink-3"
          }`}
        >
          {match.score_label}
        </span>
        <span className="min-w-0 flex-1 truncate text-end text-[14px] font-bold text-ink">{name(match.away_team)}</span>
      </div>

      {!finished && match.kickoff_at ? (
        <div className="tnum text-center text-[11.5px] text-ink-3">{kickoffLabel(match.kickoff_at, lang)}</div>
      ) : match.venue ? (
        <div className="truncate text-center text-[11.5px] text-ink-3">{name(match.venue)}</div>
      ) : null}
    </div>
  );
}

export default function MatchesRail({ matches, lang = "ar" }: { matches: Match[]; lang?: "ar" | "en" }) {
  if (!matches.length) return null;
  const t = T[lang];

  // Results first, then fixtures — each already newest-first from the API.
  const finished = matches.filter((m) => m.status === "finished");
  const upcoming = matches.filter((m) => m.status !== "finished");
  const ordered = [...finished, ...upcoming].slice(0, 6);

  return (
    <section className="mx-auto max-w-container px-6 py-8">
      <SectionHeading
        lang={lang}
        title={t.heading}
        href={lang === "ar" ? "/section/sports" : "/en/section/sports"}
        moreLabel={t.more}
        sectionKey="sports"
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {ordered.map((m) => (
          <MatchCard key={m.id} match={m} lang={lang} />
        ))}
      </div>
    </section>
  );
}
