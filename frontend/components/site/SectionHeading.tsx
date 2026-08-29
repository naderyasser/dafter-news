import Link from "next/link";

import { sectionColor, sectionIconUrl } from "@/lib/sections";

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
 * There is deliberately NO "عرض الكل" here any more. It moved to a real
 * button at the foot of each block (see SectionMore): a link tucked into the
 * top corner was the least likely thing on the block to be pressed, and it
 * competed with the nameplate for the same corner.
 */
export default function SectionHeading({
  lang,
  title,
  href,
  tone = "light",
  sectionKey,
}: {
  lang: "ar" | "en";
  title: string;
  /** Makes the nameplate itself a link to the desk. */
  href?: string;
  tone?: "light" | "dark";
  sectionKey?: string | null;
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
      className={`${isAr ? "font-display-ar" : "font-display-en"} inline-flex items-center gap-2 rounded-pill px-3.5 py-1.5 text-[clamp(1rem,0.9rem+0.5vw,1.1875rem)] font-extrabold leading-none`}
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
    <div className="mb-4 flex items-center">
      {href ? (
        <Link href={href} className="no-underline">
          {pill}
        </Link>
      ) : (
        pill
      )}
    </div>
  );
}
