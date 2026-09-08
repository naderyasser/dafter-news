import Link from "next/link";

import SectionHeading from "@/components/site/SectionHeading";
import SectionMore from "@/components/site/SectionMore";
import ListThumb from "@/components/ui/ListThumb";
import TimeAgo from "@/components/ui/TimeAgo";
import { articleCoverFallback } from "@/lib/coverFallback";
import { articleHref } from "@/lib/routes";
import { sectionColor, sectionStyle } from "@/lib/sections";
import { standfirstFor } from "@/lib/format";
import type { ArticleCard as ArticleCardType } from "@/lib/types";

/**
 * Layout variant V3 — the compact block, in two shapes.
 *
 * This is still where the page's height budget is won: «أمن ومحاكم» and
 * «دليلك الأول» once cost ~1,200px each as photo-led blocks. But the plain
 * numbered headline list that replaced them was the thing the client sent
 * back — two desks in a row rendered as the same five bare lines, and
 * «مينفعش نخلي الأقسام بالشكل ده» is a fair reading of that. Nothing here
 * grows past ~420px, and nothing is dropped: every story, every link.
 *
 * What changed: the block sits inside a panel tinted with the desk's own
 * colour, every row carries the site's one square thumbnail (see ListThumb —
 * the client's separate ask that thumbnails stop varying), and the rank
 * numeral is a filled badge in the desk's colour rather than a red digit.
 *
 * Two layouts so two adjacent desks never repeat:
 *
 *  - `cards`     — a two-column grid of bordered rows, each its own small
 *                  card. Dense; the register-like desks («أمن ومحاكم»).
 *  - `spotlight` — the newest story as a wider lead row with a larger
 *                  thumbnail and its standfirst, then the rest as a ruled
 *                  two-column list. Service desks («دليلك الأول»), where the
 *                  one answer a reader came for deserves the extra line.
 *
 * `spotlight` with a single story is just the lead row, which is also what
 * makes this the safe fallback for a photo-led desk on a quiet day (see the
 * home page's MIN_FOR_PHOTO_LED).
 */
export default function CompactListBlock({
  lang,
  title,
  href,
  sectionKey,
  cards,
  layout = "cards",
  showTime = true,
}: {
  lang: "ar" | "en";
  title: string;
  href: string;
  sectionKey?: string;
  cards: ArticleCardType[];
  layout?: "cards" | "spotlight";
  /**
   * The home page passes false. A newsroom this size cannot refile every
   * hour, and a column of «منذ يومين» down the front page reads as an
   * abandoned site rather than an honest one — the stamp costs more than it
   * tells. Section pages keep it, where a reader is scanning one desk and
   * recency is the thing being judged.
   */
  showTime?: boolean;
}) {
  if (!cards.length) return null;
  const isAr = lang === "ar";
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const accent = sectionColor(sectionKey);
  const accentVar = { "--card-accent": accent } as React.CSSProperties;

  const rank = (n: number) => (
    <span
      aria-hidden
      className="tnum flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-paper"
      style={{ backgroundColor: accent }}
    >
      {n}
    </span>
  );

  const thumb = (a: ArticleCardType, size: "sm" | "md" = "sm") => {
    const fallback = articleCoverFallback(a.kind, a.author_avatar);
    return (
      <ListThumb src={a.cover_image} size={size} fallbackSrc={fallback.src} fallbackFit={fallback.fit} position={fallback.position} />
    );
  };

  const stamp = (a: ArticleCardType) =>
    showTime ? <TimeAgo iso={a.published_at} lang={lang} className="mt-1 block text-xs text-ink-3" /> : null;

  const row = (a: ArticleCardType, i: number, ruled: boolean) => (
    <li key={a.id} className={ruled ? "border-b border-line last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0" : ""}>
      <Link
        href={articleHref(a, lang)}
        className={`card-link flex items-center gap-3 no-underline ${
          ruled ? "py-3" : "rounded-xl border border-line bg-paper p-3 transition-shadow duration-fast hover:shadow-1"
        }`}
        style={accentVar}
      >
        {rank(i + 1)}
        <span className="min-w-0 flex-1">
          <span className={`${fontDisplay} card-title block text-[15px] font-bold leading-[1.5] text-ink`}>{a.title}</span>
          {stamp(a)}
        </span>
        {thumb(a)}
      </Link>
    </li>
  );

  const [lead, ...rest] = cards;
  const standfirst = standfirstFor(lead.title, lead.standfirst);

  return (
    <section className="section-watermark mx-auto max-w-container px-6 py-8" style={sectionStyle(sectionKey)}>
      <SectionHeading lang={lang} title={title} href={href} sectionKey={sectionKey} />

      {/* The desk's colour at 5% as a panel, its border at 20%: enough to
          read as "this desk's box" next to a white block, not enough to
          compete with the photographs. */}
      <div className="rounded-2xl border p-3 sm:p-4" style={{ borderColor: `${accent}33`, backgroundColor: `${accent}0D` }}>
        {layout === "spotlight" ? (
          <>
            <Link
              href={articleHref(lead, lang)}
              className="card-link flex items-center gap-4 rounded-xl border border-line bg-paper p-3 no-underline transition-shadow duration-fast hover:shadow-1 sm:gap-5 sm:p-4"
              style={accentVar}
            >
              <span className="min-w-0 flex-1">
                <span className="text-[11.5px] font-extrabold" style={{ color: accent }}>
                  {lead.subcategory || lead.section_name}
                </span>
                <span className={`${fontDisplay} card-title mt-1 block text-[16px] font-extrabold leading-[1.5] text-ink sm:text-[18px]`}>
                  {lead.title}
                </span>
                {standfirst && <span className="mt-1.5 line-clamp-2 block text-[13.5px] leading-[1.7] text-ink-2">{standfirst}</span>}
                {stamp(lead)}
              </span>
              <span className="[&>div]:w-[104px] sm:[&>div]:w-[132px]">{thumb(lead, "md")}</span>
            </Link>
            {rest.length > 0 && (
              // CSS columns, not a grid: a grid orders items across the row
              // (2,3 / 4,5), which reads wrong for a numbered list. Columns
              // keep 2,3 down the first column, and follow the page's
              // direction so that column is the RIGHT one in Arabic.
              <ol className="m-0 mt-3 list-none p-0 sm:columns-2 sm:gap-x-8">
                {rest.map((a, i) => (
                  <li key={a.id} className="break-inside-avoid border-b border-line last:border-b-0">
                    <Link href={articleHref(a, lang)} className="card-link flex items-center gap-3 py-3 no-underline" style={accentVar}>
                      {rank(i + 2)}
                      <span className="min-w-0 flex-1">
                        <span className={`${fontDisplay} card-title block text-[15px] font-bold leading-[1.5] text-ink`}>{a.title}</span>
                        {stamp(a)}
                      </span>
                      {thumb(a)}
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </>
        ) : (
          <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">{cards.map((a, i) => row(a, i, false))}</ol>
        )}
      </div>

      <SectionMore lang={lang} href={href} />
    </section>
  );
}
