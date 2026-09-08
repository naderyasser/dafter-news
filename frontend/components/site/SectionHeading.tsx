import Link from "next/link";

import Chevron from "@/components/ui/Chevron";
import { sectionColor, sectionIconUrl } from "@/lib/sections";

const T = {
  ar: { more: "المزيد" },
  en: { more: "More" },
};

/**
 * A section's nameplate: the desk's mark and its title inside a tinted pill.
 *
 * Replaces the plain-text heading with the rule beside it. The client's
 * reference is a coloured chip — the eye finds "رياضة" as an object rather
 * than reading it as one more line of text, which matters on a page that is
 * mostly headlines.
 *
 * The tint is the desk's own colour at low alpha with the icon and text at
 * full strength, so every section is recognisably itself without thirteen
 * bespoke components. A section with no mark in SECTION_IDENTITY renders the
 * pill with its title alone rather than an empty icon slot.
 *
 * «المزيد» at the header: OFF by default. For a list block the full-width
 * button at the foot (SectionMore) is the right place — a reader wants more
 * of a desk after reading what the block offered. The carousels are the
 * exception, and the client reported it as a bug: «ثقافة وفن» had no way to
 * the desk at all, because a rail has no natural foot for a button. Pass
 * `moreHref` and the nameplate row carries a small ghost link with a chevron
 * at its inline end, ahead of whatever `actions` (the rail's arrows) follow.
 */
export default function SectionHeading({
  lang,
  title,
  href,
  tone = "light",
  sectionKey,
  moreHref,
  actions,
  className = "mb-4",
}: {
  lang: "ar" | "en";
  title: string;
  /** Makes the nameplate itself a link to the desk. */
  href?: string;
  tone?: "light" | "dark";
  sectionKey?: string | null;
  /** A header-level «المزيد» ghost link — carousels only, see above. */
  moreHref?: string;
  /** Controls that belong on the nameplate row (a rail's prev/next). */
  actions?: React.ReactNode;
  /** The wrapper's own classes; a caller that lays the row out itself passes "". */
  className?: string;
}) {
  const isAr = lang === "ar";
  const onDark = tone === "dark";
  const color = sectionColor(sectionKey);
  // On a dark band the desk colour can fall under the surface contrast, so
  // the mark and the text go to paper white and the pill carries the tint.
  const ink = onDark ? "#FFFFFF" : color;
  const icon = sectionIconUrl(sectionKey, ink);

  const pill = (
    <span
      className={`${isAr ? "font-display-ar" : "font-display-en"} inline-flex items-center gap-2 whitespace-nowrap rounded-pill px-3.5 py-1.5 text-[clamp(1rem,0.9rem+0.5vw,1.1875rem)] font-extrabold leading-none`}
      style={{
        color: ink,
        // 14% of the desk colour on paper, a lifted white on a dark band —
        // both land as "tinted", neither as a second block of colour.
        backgroundColor: onDark ? "rgba(255,255,255,.12)" : `${color}1F`,
      }}
    >
      {icon && (
        <span
          aria-hidden
          className="h-[18px] w-[26px] flex-shrink-0 bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: icon }}
        />
      )}
      {title}
    </span>
  );

  return (
    // flex-wrap: on a phone the nameplate, a «المزيد» link and a rail's two
    // arrows do not all fit one row; the link drops under the pill rather
    // than the pill breaking across two lines.
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {href ? (
        <Link href={href} className="no-underline">
          {pill}
        </Link>
      ) : (
        pill
      )}
      {(moreHref || actions) && (
        <div className="ms-auto flex flex-shrink-0 items-center gap-2">
          {moreHref && (
            <Link
              href={moreHref}
              className={`inline-flex items-center gap-1 rounded-pill border px-3 py-1.5 text-[13px] font-bold no-underline transition-colors duration-fast ${
                onDark
                  ? "border-white/25 text-paper hover:border-paper hover:bg-white/10"
                  : "border-line text-ink-2 hover:border-brand hover:bg-brand-tint hover:text-brand"
              }`}
            >
              {T[lang].more}
              <Chevron lang={lang} className="h-3.5 w-3.5" />
            </Link>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
