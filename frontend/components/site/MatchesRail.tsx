import SectionHeading from "@/components/site/SectionHeading";
import type { Match } from "@/lib/types";

/**
 * TheSportsDB returns club, venue and league names in English only, so the
 * Arabic rail was printing "Ghazl El Mahalla" next to "الجولة 13". There is
 * no Arabic column on Match to fall back to, so the names are mapped here —
 * anything unmapped (a cup opponent, a newly promoted side) still renders in
 * English rather than disappearing.
 */
const AR_NAMES: Record<string, string> = {
  // clubs
  "al ahly": "الأهلي",
  zamalek: "الزمالك",
  pyramids: "بيراميدز",
  ismaily: "الإسماعيلي",
  "al masry": "المصري",
  "ghazl el mahalla": "غزل المحلة",
  "haras el hodoud": "حرس الحدود",
  enppi: "إنبي",
  smouha: "سموحة",
  "el gouna": "الجونة",
  "ceramica cleopatra": "سيراميكا كليوباترا",
  "future fc": "فيوتشر",
  "modern future": "مودرن فيوتشر",
  "national bank of egypt": "البنك الأهلي",
  pharco: "فاركو",
  zed: "زد",
  "al ittihad alexandria": "الاتحاد السكندري",
  "tala'ea el gaish": "طلائع الجيش",
  "talaea el gaish": "طلائع الجيش",
  "baladiyat el mahalla": "بلدية المحلة",
  petrojet: "بتروجت",
  aswan: "أسوان",
  "eastern company": "الشرقية للدخان",
  // venues
  "el mahalla stadium": "استاد المحلة",
  "cairo international stadium": "استاد القاهرة الدولي",
  "borg el arab stadium": "استاد برج العرب",
  "al salam stadium": "استاد السلام",
  "petro sport stadium": "استاد بتروسبورت",
  // competition
  "egyptian premier league": "الدوري المصري الممتاز",
};

const ar = (value?: string | null) => (value ? AR_NAMES[value.trim().toLowerCase()] ?? value : "");

/**
 * Results and fixtures for جوّه الجون.
 *
 * Played matches lead — a reader checking the football rail wants the score
 * first — and upcoming fixtures follow with kickoff times instead of a
 * score, so an unplayed match never reads as a goalless draw.
 */
function kickoffLabel(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ar-EG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function MatchCard({ match }: { match: Match }) {
  const finished = match.status === "finished";
  const live = match.status === "live";

  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-line bg-paper p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11.5px] font-semibold text-ink-3">{match.round_label || ar(match.league)}</span>
        {live ? (
          <span className="flex flex-shrink-0 items-center gap-1.5 rounded-badge bg-badge-live px-2 py-0.5 text-[11px] font-bold text-paper">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-paper" />
            مباشر
          </span>
        ) : (
          <span className="flex-shrink-0 text-[11.5px] text-ink-3">{finished ? "انتهت" : "قادمة"}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">{ar(match.home_team)}</span>
        <span
          className={`tnum flex-shrink-0 rounded px-2.5 py-1 text-[15px] font-extrabold ${
            finished || live ? "bg-navy text-paper" : "bg-surface-2 text-ink-3"
          }`}
        >
          {match.score_label}
        </span>
        <span className="min-w-0 flex-1 truncate text-end text-[14px] font-bold text-ink">{ar(match.away_team)}</span>
      </div>

      {!finished && match.kickoff_at ? (
        <div className="tnum text-center text-[11.5px] text-ink-3">{kickoffLabel(match.kickoff_at)}</div>
      ) : match.venue ? (
        <div className="truncate text-center text-[11.5px] text-ink-3">{ar(match.venue)}</div>
      ) : null}
    </div>
  );
}

export default function MatchesRail({ matches }: { matches: Match[] }) {
  if (!matches.length) return null;

  // Results first, then fixtures — each already newest-first from the API.
  const finished = matches.filter((m) => m.status === "finished");
  const upcoming = matches.filter((m) => m.status !== "finished");
  const ordered = [...finished, ...upcoming].slice(0, 6);

  return (
    <section className="mx-auto max-w-container px-6 py-6">
      <SectionHeading lang="ar" title="نتائج ومباريات" href="/section/sports" moreLabel="جوّه الجون" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {ordered.map((m) => (
          <MatchCard key={m.id} match={m} />
        ))}
      </div>
    </section>
  );
}
