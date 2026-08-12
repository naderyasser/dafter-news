import Link from "next/link";

import Chevron from "@/components/ui/Chevron";
import CoverImage from "@/components/ui/CoverImage";
import { sectionColor } from "@/lib/sections";

const T = {
  ar: { drop: "أفلت صورة الغلاف هنا", more: "عرض الكل" },
  en: { drop: "Drop cover photo here", more: "See all" },
};

/**
 * The home-page masthead for a section that has a cover photo set: title and
 * tagline set directly into a full-bleed banner, replacing the plain text
 * heading a section gets by default.
 *
 * Callers only reach for this when `imageSrc` is actually set — a section
 * without a cover photo keeps its ordinary `SectionHeading`, the same
 * graceful "no entry, no special treatment" rule `sections.ts` already
 * applies to accent colours and watermarks.
 */
export default function SectionMasthead({
  lang,
  title,
  tagline,
  imageSrc,
  sectionKey,
  href,
  moreLabel,
}: {
  lang: "ar" | "en";
  title: string;
  tagline?: string;
  imageSrc?: string | null;
  sectionKey?: string | null;
  href?: string;
  moreLabel?: string;
}) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const accent = sectionColor(sectionKey);

  return (
    <div className="relative mb-5 overflow-hidden rounded-card">
      <div className="relative aspect-[16/9] sm:aspect-[21/9]">
        <CoverImage src={imageSrc} alt="" placeholder={t.drop} className="absolute inset-0" sizes="(min-width: 1024px) 1200px, 100vw" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(6,10,20,.9)] via-[rgba(6,10,20,.35)] to-[rgba(6,10,20,.12)]"
        />
      </div>

      {href && (
        <Link
          href={href}
          className="absolute end-4 top-4 z-10 flex items-center gap-1.5 rounded-pill bg-[rgba(10,11,13,.45)] px-3.5 py-1.5 text-[12px] font-bold text-paper no-underline backdrop-blur-sm transition-colors duration-fast hover:bg-[rgba(10,11,13,.65)]"
        >
          {moreLabel ?? t.more}
          <Chevron lang={lang} className="h-3 w-3" />
        </Link>
      )}

      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
        <span
          className={`${fontDisplay} rule-accent rule-on-dark inline-block ps-3.5 text-[clamp(1.5rem,1.1rem+1.8vw,2.25rem)] font-extrabold text-paper`}
          style={{ "--rule-b": accent } as React.CSSProperties}
        >
          {title}
        </span>
        {tagline && (
          <p className="relative m-0 mt-2 max-w-[54ch] ps-3.5 text-[14px] leading-[1.75] text-paper/85 sm:text-[15px]">{tagline}</p>
        )}
      </div>
    </div>
  );
}
