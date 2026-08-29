import Link from "next/link";

import ClockIcon from "@/components/ui/ClockIcon";
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
  /** Country label riding the photo itself — set only by «الخليج العربي»,
   *  the one caller of this block with geographic desks. `section` stays the
   *  plain-text kicker in the text column regardless (Egypt's only label,
   *  and Gulf's topic when it has one) — same "chip on the photo, kicker
   *  beside the headline" split WorldNewsBlock already uses. */
  chip?: string;
};

const T = {
  ar: { drop: "أفلت صورة الخبر هنا", more: "عرض المزيد من الأخبار" },
  en: { drop: "Drop image here", more: "More stories" },
};

/**
 * Same floating-tag language as ArticleCard's PhotoChip and WorldNewsBlock's
 * own Chip — solid fill, shadow, a hairline ring for edge definition on a
 * photo of any brightness. Renders nothing for Egypt's rows, which never set
 * a chip.
 *
 * Top-start, not bottom-start like those two: the lead here already anchors
 * its headline and time to the photo's *bottom* edge (see below), so a
 * bottom chip would sit on top of that text on a short headline. Top-start
 * is clear on both the lead and the plain list thumbnails, which have
 * nothing else in that corner either way.
 */
function PhotoChip({ label, accent }: { label?: string; accent: string }) {
  if (!label) return null;
  return (
    <span
      className="absolute start-2 top-2 z-10 rounded-badge px-2.5 py-1 text-[11px] font-extrabold text-paper shadow-2 ring-1 ring-inset ring-white/15"
      style={{ backgroundColor: accent }}
    >
      {label}
    </span>
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
 * The block itself sits on plain white (`bg-paper`), not a navy band — the
 * client tried the full navy backdrop and reverted to white on later
 * review; only the lead photo keeps its navy tint, since that one is
 * legibility for the overlaid headline, not the section's background.
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
    <section className="bg-paper py-8">
    <div className="mx-auto max-w-container px-6">
      {coverImage ? (
        <SectionMasthead lang={lang} title={title} tagline={tagline} imageSrc={coverImage} sectionKey={sectionKey} href={seeAllHref} />
      ) : (
        <SectionHeading lang={lang} title={title} href={seeAllHref} sectionKey={sectionKey} />
      )}

      <div className="overflow-hidden rounded-card border border-line">
        {/* Lead: full-bleed photo, headline and time set directly into it. */}
        <Link href={lead.href} className="card-link relative block no-underline" style={accentVar}>
          <div className="relative aspect-[16/10] max-h-[480px] sm:aspect-[21/9]">
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
            <PhotoChip label={lead.chip} accent={accent} />
          </div>
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
            {/* line-clamp-3, not just a smaller size: a long headline
                otherwise keeps wrapping until it eats the whole photo — on a
                narrow phone (aspect-[16/10], no room to grow) a long enough
                sentence covered the image almost edge to edge. Capping the
                lines is what actually guarantees the photo stays visible,
                independent of how long the headline is. */}
            <h3
              className={`${fontDisplay} m-0 line-clamp-3 text-[clamp(1.0625rem,0.9rem+1vw,1.5rem)] font-extrabold leading-[1.3] text-paper`}
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
                    {c.chip && (
                      <span
                        className="absolute start-1 top-1 z-10 rounded-badge px-1.5 py-0.5 text-[9px] font-extrabold text-paper shadow-1 ring-1 ring-inset ring-white/15"
                        style={{ backgroundColor: accent }}
                      >
                        {c.chip}
                      </span>
                    )}
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
