import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";
import type { Badge } from "@/lib/types";

const T = {
  ar: { drop: "أفلت صورة الخبر هنا", share: "مشاركة", shareGlyph: "↖", breaking: "عاجل", live: "مباشر", exclusive: "خاص" },
  en: { drop: "Drop image here", share: "Share", shareGlyph: "↗", breaking: "Breaking", live: "Live", exclusive: "Exclusive" },
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
      className={`absolute start-2 top-2 z-10 flex items-center rounded-badge ${b.bg} px-[9px] font-bold text-paper ${
        size === "sm" ? "py-[2px] text-[10px]" : "py-[3px] text-xs"
      }`}
    >
      {b.dot && <span className="me-1 h-1.5 w-1.5 animate-pulse-dot rounded-full bg-paper" />}
      {b.label}
    </span>
  );
}

type CardProps = {
  lang: "ar" | "en";
  variant: "standard" | "compact" | "text" | "hero";
  href: string;
  title: string;
  section?: string;
  time?: string;
  excerpt?: string;
  badge?: Badge;
  imageSrc?: string | null;
  isVideo?: boolean;
  videoDuration?: string;
  comments?: number;
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
  excerpt,
  badge = "none",
  imageSrc,
  isVideo,
  videoDuration,
  comments,
  accent,
}: CardProps) {
  const t = T[lang];
  const fontDisplay = lang === "ar" ? "font-display-ar" : "font-display-en";
  const accentVar = accent ? ({ "--card-accent": accent } as React.CSSProperties) : undefined;

  if (variant === "hero") {
    return (
      <Link href={href} className="relative block overflow-hidden rounded-card">
        <div className="relative aspect-[16/10]">
          <CoverImage src={imageSrc} alt={title} placeholder={t.drop} className="absolute inset-0" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(10,11,13,.88)] via-[rgba(10,11,13,.15)] to-transparent" />
        </div>
        <BadgeChip badge={badge} lang={lang} />
        <div className="absolute inset-x-0 bottom-0 p-5">
          {section && <span className="text-xs font-bold text-navy-tint">{section}</span>}
          <h3 className={`${fontDisplay} m-0 mt-1.5 text-[clamp(1.25rem,1rem+1.6vw,1.75rem)] font-extrabold leading-[1.4] text-paper`}>
            {title}
          </h3>
        </div>
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link href={href} className="card-link flex gap-3 py-2.5 no-underline" style={accentVar}>
        <div className="relative w-[120px] flex-shrink-0 overflow-hidden rounded-card">
          <div className="relative aspect-[4/3]">
            <CoverImage src={imageSrc} alt={title} placeholder={t.drop} className="absolute inset-0" />
          </div>
          <BadgeChip badge={badge} lang={lang} size="sm" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className={`${fontDisplay} card-title m-0 text-[15px] font-bold leading-[1.45] text-ink`}>{title}</h3>
          {time && <div className="mt-1.5 text-xs text-ink-3">{time}</div>}
        </div>
      </Link>
    );
  }

  if (variant === "text") {
    return (
      <Link href={href} className="card-link block border-b border-line py-3.5 no-underline" style={accentVar}>
        <h3 className={`${fontDisplay} card-title m-0 text-h3 font-bold leading-[1.5] text-ink`}>{title}</h3>
        {excerpt && <div className="mt-1.5 text-[14px] leading-[1.6] text-ink-2">{excerpt}</div>}
        {time && <div className="mt-2 text-caption text-ink-3">{time}</div>}
      </Link>
    );
  }

  // standard
  return (
    <Link href={href} className="card-link block overflow-hidden rounded-card border border-line bg-paper no-underline" style={accentVar}>
      <div className="relative aspect-video">
        <CoverImage src={imageSrc} alt={title} placeholder={t.drop} className="absolute inset-0" />
        <BadgeChip badge={badge} lang={lang} />
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
        {time && <div className="mt-1.5 text-caption text-ink-3">{time}</div>}
        {isVideo && (
          <div className="mt-2 flex gap-3.5 text-caption text-ink-3">
            <span>💬 {comments ?? 0}</span>
            <span>
              {t.shareGlyph} {t.share}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
