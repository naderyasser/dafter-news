import Link from "next/link";

import { sectionColor } from "@/lib/sections";
import Chevron from "@/components/ui/Chevron";

/**
 * Section heading carrying the notebook-margin rule plus a "more" arrow
 * (the «أمريكا ›» pattern). The chevron mirrors in RTL so it always points
 * away from the text, i.e. onward.
 *
 * The rule is the two-tone red/blue bar (`.rule-accent`), and `sectionKey`
 * swaps its blue half for that section's own colour — so «جوّه الجون» reads
 * red-over-green without a second component.
 */
export default function SectionHeading({
  lang,
  title,
  href,
  moreLabel,
  tone = "light",
  sectionKey,
}: {
  lang: "ar" | "en";
  title: string;
  href?: string;
  moreLabel?: string;
  tone?: "light" | "dark";
  sectionKey?: string | null;
}) {
  const isAr = lang === "ar";
  const onDark = tone === "dark";

  const heading = (
    <span
      // inline-block, not inline: the rule is an absolutely-positioned
      // pseudo-element, so it needs a box with a height to stretch against.
      className={`${isAr ? "font-display-ar" : "font-display-en"} rule-accent inline-block ps-3.5 text-[clamp(1.1875rem,1rem+0.8vw,1.375rem)] font-extrabold ${
        onDark ? "rule-on-dark text-paper" : "text-ink"
      }`}
      // On a dark band the section's own colour can fall below the surface's
      // contrast; the accent blue is legible on both, so only light headings
      // take the per-section tint.
      style={sectionKey && !onDark ? ({ "--rule-b": sectionColor(sectionKey) } as React.CSSProperties) : undefined}
    >
      {title}
    </span>
  );

  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      {href ? (
        <Link href={href} className="no-underline">
          {heading}
        </Link>
      ) : (
        heading
      )}

      {href ? (
        <Link
          href={href}
          className={`flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px] font-bold no-underline transition-colors duration-fast ${
            onDark ? "text-header-muted hover:text-paper" : "text-ink-3 hover:text-accent"
          }`}
        >
          {moreLabel ?? (isAr ? "عرض الكل" : "See all")}
          <Chevron lang={lang} className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  );
}
