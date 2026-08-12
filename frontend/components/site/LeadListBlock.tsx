import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";
import Chevron from "@/components/ui/Chevron";
import SectionHeading from "@/components/site/SectionHeading";
import SectionMasthead from "@/components/site/SectionMasthead";
import { sectionColor } from "@/lib/sections";

export type LeadListCard = {
  href: string;
  title: string;
  section?: string;
  time?: string;
  imageSrc?: string | null;
};

const T = {
  ar: { drop: "أفلت صورة الخبر هنا", more: "عرض المزيد من الأخبار" },
  en: { drop: "Drop image here", more: "More stories" },
};

/** A plain stroked clock — the block's only icon, so it stays a single line. */
function ClockIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7v5l3.3 1.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The «شؤون مصر» treatment — a photo lead with the headline set into the
 * image over a navy tint (the client's reference, not the neutral-black
 * scrim most photo overlays on this site use), then the rest of the desk
 * as a plain white list underneath. Built for Egypt first; reused as-is
 * for «الخليج العربي» on the client's explicit request that the two
 * sections share one design rather than Gulf keeping the plain card grid
 * every other section still uses.
 *
 * The list rows put the image last in the markup rather than first: this
 * site is RTL throughout, so the last child in a flex row lands at the
 * inline-end (the left edge) — headline leading at the right, photograph
 * trailing at the left, the same ordering the politics spine already uses.
 * A card's own section rides the kicker in the section's colour, never the
 * brand red, so the row style stays consistent with every other block on
 * the page rather than inventing a second badge language.
 */
export default function LeadListBlock({
  lang,
  title,
  seeAllHref,
  sectionKey,
  cards,
  coverImage,
  tagline,
}: {
  lang: "ar" | "en";
  title: string;
  seeAllHref: string;
  sectionKey: string;
  cards: LeadListCard[];
  /** A cover photo swaps the plain text heading for the full-bleed masthead. */
  coverImage?: string | null;
  tagline?: string;
}) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const [lead, ...rest] = cards;
  const accent = sectionColor(sectionKey);
  const accentVar = { "--card-accent": accent } as React.CSSProperties;

  if (!lead) return null;

  return (
    <section className="bg-navy py-8">
    <div className="mx-auto max-w-container px-6">
      {coverImage ? (
        <SectionMasthead lang={lang} title={title} tagline={tagline} imageSrc={coverImage} sectionKey={sectionKey} href={seeAllHref} />
      ) : (
        <SectionHeading lang={lang} title={title} href={seeAllHref} sectionKey={sectionKey} tone="dark" />
      )}

      <div className="overflow-hidden rounded-card border border-line">
        {/* Lead: full-bleed photo, headline and time set directly into it. */}
        <Link href={lead.href} className="card-link relative block no-underline" style={accentVar}>
          <div className="relative aspect-[16/10] sm:aspect-[21/9]">
            <CoverImage
              src={lead.imageSrc}
              alt={lead.title}
              placeholder={t.drop}
              className="absolute inset-0"
              sizes="(min-width: 1024px) 1200px, 100vw"
            />
            {/* Navy, not the neutral-black scrim other photo overlays on the
                site use — the client's reference tints the whole photo
                blue, not just a dark fade at the bottom. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(7,50,82,.93)] via-[rgba(7,50,82,.45)] to-[rgba(7,50,82,.18)]"
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
            <h3
              className={`${fontDisplay} m-0 text-[clamp(1.25rem,1rem+1.6vw,1.875rem)] font-extrabold leading-[1.4] text-paper`}
            >
              {lead.title}
            </h3>
            {lead.time && (
              <div className="tnum mt-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-paper/85">
                <ClockIcon />
                {lead.time}
              </div>
            )}
          </div>
        </Link>

        {/* The rest, on white — the desk's usual surface, not the lead's dark one. */}
        {rest.length > 0 && (
          <div className="bg-paper">
            {rest.map((c, i) => (
              <Link
                key={c.href + i}
                href={c.href}
                className="card-link flex items-center gap-4 border-t border-line px-4 py-3.5 no-underline sm:px-5"
                style={accentVar}
              >
                <div className="min-w-0 flex-1">
                  {c.section && (
                    <span className="text-[12px] font-bold" style={{ color: accent }}>
                      {c.section}
                    </span>
                  )}
                  <h4
                    className={`${fontDisplay} card-title m-0 mt-1 text-[15px] font-extrabold leading-[1.55] text-ink sm:text-[16px]`}
                  >
                    {c.title}
                  </h4>
                  {c.time && (
                    <div className="tnum mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-3">
                      <ClockIcon />
                      {c.time}
                    </div>
                  )}
                </div>
                {c.imageSrc && (
                  <div className="relative h-[64px] w-[92px] flex-shrink-0 overflow-hidden rounded-[3px] sm:h-[72px] sm:w-[104px]">
                    <CoverImage src={c.imageSrc} alt="" placeholder="" className="absolute inset-0" sizes="104px" />
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 text-center">
        <Link
          href={seeAllHref}
          className="inline-flex items-center gap-2 rounded-pill border border-line bg-paper px-7 py-2.5 text-[14px] font-semibold text-ink no-underline transition-colors duration-fast hover:border-accent hover:text-accent"
        >
          {t.more}
          <Chevron lang={lang} className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
    </section>
  );
}
