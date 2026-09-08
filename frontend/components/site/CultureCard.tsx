import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";
import { articleCoverFallback } from "@/lib/coverFallback";
import { SITE_NAME } from "@/lib/seo";

export type CultureCardProps = {
  lang: "ar" | "en";
  href: string;
  title: string;
  imageSrc?: string | null;
  /** The red corner tag — the subcategory, or the section name. */
  chip?: string;
  /** The byline: who filed the piece, shown as a badge on the photo. On an
   *  interview this is the reporter, not the guest — the API carries no
   *  interviewee field. */
  authorName?: string;
  authorAvatar?: string | null;
  authorInitial?: string;
  /** The desk's colour — the chip and the byline ring. */
  accent: string;
};

/**
 * «ثقافة وفن»'s slide — the rich-media card the client asked for ahead of
 * the Ramadan season's run of interviews with artists.
 *
 * A portrait photograph (4:5, the shape of a face and of a phone screen)
 * under a heavy bottom gradient, the headline set into the dark, the
 * byline riding the photo as a badge with a circular portrait, and the
 * desk's tag in the corner. Portrait rather than the old 16:10 hero card:
 * three of these fit a desktop row side by side, one fills a phone, and a
 * person photographed for an interview is upright in both.
 */
export default function CultureCard({ lang, href, title, imageSrc, chip, authorName, authorAvatar, authorInitial, accent }: CultureCardProps) {
  const fontDisplay = lang === "ar" ? "font-display-ar" : "font-display-en";
  const fallback = imageSrc ? null : articleCoverFallback("news", null);
  const coverSrc = imageSrc || fallback?.src;

  return (
    <Link
      href={href}
      className="card-link group relative block overflow-hidden rounded-2xl bg-ink shadow-1 transition-shadow duration-med hover:shadow-2"
      style={{ "--card-accent": accent } as React.CSSProperties}
    >
      <div className="relative aspect-[4/5]">
        <CoverImage
          src={coverSrc}
          alt={title}
          placeholder={SITE_NAME[lang]}
          className="absolute inset-0"
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 82vw"
          fit={fallback?.fit ?? "cover"}
          position="top"
        />
        {/* Heavier than the hero card's scrim: the headline sits on a
            photograph of a face, and needs the bottom third solidly dark. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(10,11,13,.94)] via-[rgba(10,11,13,.42)] via-45% to-transparent"
        />
      </div>

      {chip && (
        <span
          className="absolute start-3 top-3 z-10 rounded-badge px-2.5 py-1 text-[11px] font-extrabold text-paper shadow-2 ring-1 ring-inset ring-white/15"
          style={{ backgroundColor: accent }}
        >
          {chip}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-5">
        {authorName && (
          <span className="mb-3 inline-flex max-w-full items-center gap-2 rounded-pill bg-white/15 py-1 pe-3 ps-1 text-[12px] font-bold text-paper backdrop-blur-sm ring-1 ring-inset ring-white/20">
            <span
              className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper text-[12px] font-extrabold text-ink ring-2"
              style={{ "--tw-ring-color": accent } as React.CSSProperties}
            >
              {authorAvatar ? (
                <CoverImage src={authorAvatar} alt="" placeholder="" className="absolute inset-0" sizes="28px" position="top" />
              ) : (
                authorInitial || "؟"
              )}
            </span>
            <span className="truncate">{authorName}</span>
          </span>
        )}
        <h3 className={`${fontDisplay} m-0 line-clamp-3 text-[clamp(1rem,0.9rem+0.6vw,1.25rem)] font-extrabold leading-[1.4] text-paper`}>
          {title}
        </h3>
      </div>
    </Link>
  );
}
