import Link from "next/link";

import ClockIcon from "@/components/ui/ClockIcon";
import CoverImage from "@/components/ui/CoverImage";
import ListThumb from "@/components/ui/ListThumb";
import TimeAgo from "@/components/ui/TimeAgo";
import { articleCoverFallback } from "@/lib/coverFallback";
import { SITE_NAME } from "@/lib/seo";
import type { Badge } from "@/lib/types";

const T = {
  // Reader-facing copy, not the editor's own drag-and-drop instruction —
  // this is the placeholder's last resort now that a missing cover always
  // has a real fallback image first (see articleCoverFallback), reachable
  // only if that image itself fails to load.
  ar: { drop: SITE_NAME.ar, share: "مشاركة", shareGlyph: "↖", breaking: "عاجل", live: "مباشر", exclusive: "خاص" },
  en: { drop: SITE_NAME.en, share: "Share", shareGlyph: "↗", breaking: "Breaking", live: "Live", exclusive: "Exclusive" },
};

function BadgeChip({ badge, lang, size = "md" }: { badge: Badge; lang: "ar" | "en"; size?: "md" | "sm" }) {
  if (badge === "none") return null;
  const t = T[lang];
  const map = {
    breaking: { bg: "bg-badge-breaking", label: t.breaking, dot: false },
    live: { bg: "bg-badge-live", label: t.live, dot: true },
    exclusive: { bg: "bg-gold", label: t.exclusive, dot: false },
  } as const;
  const b = map[badge];
  return (
    <span
      // shadow-2 + the ring: a solid-colour pill dropped straight onto a
      // photo has no guaranteed contrast against it — a bright sky or a
      // white shirt behind "عاجل" left the badge reading as a smudge. The
      // shadow lifts it off the image and the 1px ring keeps its own edge
      // crisp against a background close to its own colour (the gold badge
      // on a sand-toned photo, mainly).
      className={`absolute start-2 top-2 z-10 flex items-center rounded-badge ${b.bg} px-[9px] font-bold text-paper shadow-2 ring-1 ring-inset ring-white/15 ${
        size === "sm" ? "py-[2px] text-[10px]" : "py-[3px] text-xs"
      }`}
    >
      {b.dot && <span className="me-1 h-1.5 w-1.5 animate-pulse-dot rounded-full bg-paper" />}
      {b.label}
    </span>
  );
}

/**
 * Solid label on the photo — the country on «الخليج»/«عرب وعالم» cards.
 * Never in the top-start corner, which «عاجل»/«خاص» owns, so a breaking
 * Kuwait story wears both without stacking.
 *
 * Same shadow/ring treatment as BadgeChip, for one consistent "tag on a
 * photo" language across the whole home page rather than two different
 * badge styles depending on which corner a reader is looking at.
 *
 * Placement follows what else is on the photo:
 *
 * - `corner` — flush in the bottom-start corner, for the standard and
 *   compact cards, whose photo carries no text at all. Nothing can collide
 *   with it there.
 * - `row` — an ordinary flex item beside the timestamp, for the hero card,
 *   which sets its headline and time INTO the photo. Anchoring the chip to
 *   that same corner is what laid the red tag across the time and made it
 *   unreadable; as flex siblings the two cannot overlap. See the hero
 *   branch below.
 */
function PhotoChip({ label, accent, placement = "corner" }: { label?: string; accent?: string; placement?: "corner" | "row" }) {
  if (!label) return null;
  const paint = "bg-brand px-2.5 py-1 text-[11px] font-extrabold text-paper shadow-2 ring-1 ring-inset ring-white/15";
  const style = accent ? { backgroundColor: accent } : undefined;
  if (placement === "row") {
    return (
      <span className={`rounded-badge ${paint}`} style={style}>
        {label}
      </span>
    );
  }
  return (
    <span className={`absolute bottom-0 start-0 z-10 max-w-full truncate ${paint}`} style={style}>
      {label}
    </span>
  );
}

type CardProps = {
  lang: "ar" | "en";
  variant: "standard" | "compact" | "text" | "hero";
  href: string;
  title: string;
  section?: string;
  /** Pre-formatted elapsed-time string. Legacy: prefer `iso`, which renders
   *  the same phrase inside a machine-readable <time datetime>. Ignored when
   *  `iso` is set, so a caller migrating to `iso` can't print two stamps. */
  time?: string;
  /** The story's published_at, verbatim from the API. Renders via TimeAgo. */
  iso?: string | null;
  excerpt?: string;
  badge?: Badge;
  imageSrc?: string | null;
  /** Set for an article card (omitted for a video card) — gates the
   *  author-avatar fallback to opinion pieces specifically. */
  kind?: "news" | "opinion";
  /** The byline's own photo — the fallback cover for an opinion piece with
   *  no cover_image of its own. Ignored when `kind` isn't "opinion". */
  authorAvatar?: string | null;
  isVideo?: boolean;
  videoDuration?: string;
  comments?: number;
  /** Country (or other geographic) label shown on the photo itself. */
  chip?: string;
  /**
   * The owning section's colour. Paints the kicker and the headline hover;
   * defaults to the accent blue. The kicker used to be brand red on every
   * card on the page, which made the red the loudest thing in a grid of
   * photographs and left nothing for «عاجل» to escalate to.
   */
  accent?: string;
};

export default function ArticleCard({
  lang,
  variant,
  href,
  title,
  section,
  time,
  iso,
  excerpt,
  badge = "none",
  imageSrc,
  kind,
  authorAvatar,
  isVideo,
  videoDuration,
  comments,
  chip,
  accent,
}: CardProps) {
  const t = T[lang];
  const fontDisplay = lang === "ar" ? "font-display-ar" : "font-display-en";
  const accentVar = accent ? ({ "--card-accent": accent } as React.CSSProperties) : undefined;
  // `iso` wins where both are supplied — see the prop's own note. `hasTime`
  // is what the wrapper rows below test, so a card with neither doesn't
  // render an empty meta row that still costs its margin.
  const stamp = iso ? <TimeAgo iso={iso} lang={lang} /> : time ? <>{time}</> : null;
  const hasTime = Boolean(iso || time);
  // A missing cover_image always resolves to SOMETHING now — a columnist's
  // own photo for an opinion piece, the site's own mark otherwise — so
  // CoverImage's own text placeholder is reached only if that image itself
  // then fails to load, not on every uncovered story.
  const fallback = imageSrc ? null : articleCoverFallback(kind, authorAvatar);
  const coverSrc = imageSrc || fallback?.src;
  const coverFit = fallback?.fit ?? "cover";
  const coverPosition = fallback?.position ?? "center";

  if (variant === "hero") {
    return (
      <Link href={href} className="relative block overflow-hidden rounded-card">
        <div className="relative aspect-[16/10] max-h-[480px]">
          <CoverImage src={coverSrc} alt={title} placeholder={t.drop} className="absolute inset-0" fit={coverFit} position={coverPosition} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(10,11,13,.88)] via-[rgba(10,11,13,.15)] to-transparent" />
        </div>
        <BadgeChip badge={badge} lang={lang} />
        <div className="absolute inset-x-0 bottom-0 p-5">
          {section && <span className="text-xs font-bold text-navy-tint">{section}</span>}
          <h3 className={`${fontDisplay} m-0 mt-1.5 line-clamp-3 text-[clamp(1.0625rem,0.9rem+1vw,1.5rem)] font-extrabold leading-[1.3] text-paper`}>
            {title}
          </h3>
          {/* Chip at the inline start, time pushed to the inline end — the
              one row that used to be two elements stacked on the same
              corner. flex-wrap so a long label and the time stack instead
              of colliding on a narrow phone. */}
          {(chip || hasTime) && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <PhotoChip label={chip} accent={accent} placement="row" />
              {hasTime && (
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-paper/85">
                  <ClockIcon />
                  {stamp}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    );
  }

  if (variant === "compact") {
    // The row shape every feed on the site shares: headline first, then the
    // one square thumbnail (see ListThumb) at the inline end. This used to
    // be a 120px 4:3 photo at the inline START, which was one of the ten
    // frames the client read as "some wide, some square".
    return (
      <Link href={href} className="card-link flex items-center gap-3.5 py-2.5 no-underline" style={accentVar}>
        <div className="min-w-0 flex-1">
          <h3 className={`${fontDisplay} card-title m-0 text-[15px] font-bold leading-[1.5] text-ink`}>{title}</h3>
          {hasTime && <div className="mt-1.5 text-xs text-ink-3">{stamp}</div>}
        </div>
        <ListThumb src={coverSrc} alt={title} placeholder={t.drop} fit={coverFit} position={coverPosition}>
          <BadgeChip badge={badge} lang={lang} size="sm" />
          <PhotoChip label={chip} accent={accent} />
        </ListThumb>
      </Link>
    );
  }

  if (variant === "text") {
    return (
      <Link href={href} className="card-link block border-b border-line py-3.5 no-underline" style={accentVar}>
        <h3 className={`${fontDisplay} card-title m-0 text-h3 font-bold leading-[1.5] text-ink`}>{title}</h3>
        {excerpt && <div className="mt-1.5 text-[14px] leading-[1.6] text-ink-2">{excerpt}</div>}
        {hasTime && <div className="mt-2 text-caption text-ink-3">{stamp}</div>}
      </Link>
    );
  }

  // standard
  return (
    <Link href={href} className="card-link block overflow-hidden rounded-card border border-line bg-paper no-underline" style={accentVar}>
      <div className="relative aspect-video">
        <CoverImage src={coverSrc} alt={title} placeholder={t.drop} className="absolute inset-0" fit={coverFit} position={coverPosition} />
        <BadgeChip badge={badge} lang={lang} />
        <PhotoChip label={chip} accent={accent} />
        {isVideo && (
          <>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[rgba(23,26,31,.5)] text-lg text-paper transition-colors duration-fast hover:bg-brand">
                <span className={`inline-block ${lang === "ar" ? "-scale-x-100" : ""}`}>▶</span>
              </span>
            </div>
            {videoDuration && (
              <span className="tnum absolute bottom-2 start-2 rounded-badge bg-[rgba(23,26,31,.75)] px-1.5 py-0.5 text-xs text-paper">
                {videoDuration}
              </span>
            )}
          </>
        )}
      </div>
      <div className="px-0.5 pb-1 pt-3.5">
        {/* The kicker is where the section's own colour lands — green over a
            «جوّه الجون» card, purple over «ثقافة وفن» — so a card carries its
            section even when it is lifted out of the block. */}
        {section && (
          <span className="text-xs font-bold text-accent" style={accent ? { color: accent } : undefined}>
            {section}
          </span>
        )}
        <h3 className={`${fontDisplay} card-title m-0 mt-2 text-h3 font-bold leading-[1.5] text-ink`}>{title}</h3>
        {hasTime && <div className="mt-1.5 text-caption text-ink-3">{stamp}</div>}
        {isVideo && (
          <div className="mt-2 flex gap-3.5 text-caption text-ink-3">
            {/* «٠ تعليق» is not a fact worth printing — an empty counter reads
                as "nobody is here" and actively costs the card credibility.
                Shown only once there is something to report. */}
            {comments ? <span>💬 {comments}</span> : null}
            <span>
              {t.shareGlyph} {t.share}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
