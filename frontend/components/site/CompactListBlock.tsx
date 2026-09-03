import Link from "next/link";

import SectionHeading from "@/components/site/SectionHeading";
import SectionMore from "@/components/site/SectionMore";
import TimeAgo from "@/components/ui/TimeAgo";
import { articleHref } from "@/lib/routes";
import type { ArticleCard as ArticleCardType } from "@/lib/types";

/**
 * Layout variant V3 — the headline-only compact list.
 *
 * This is where the page's height budget is won. «أمن ومحاكم» and «دليلك
 * الأول» were rendering as photo-led blocks costing ~1,200px EACH, for six
 * stories apiece; as a two-column headline list the same six stories cost
 * roughly a fifth of that. Nothing is dropped — the reader gets the same
 * headlines and the same links, without a 16:9 photograph attached to each
 * one.
 *
 * Two columns on desktop, one on a phone. Numbered rows rather than
 * thumbnails: with no image to anchor them, the numerals give the eye
 * something to track down the column, and they cost no layout height beyond
 * the text itself.
 *
 * The header is the same shared SectionHeading every other block uses — the
 * spec's point that header consistency and body variety are the two halves
 * of one component, not a contradiction.
 */
export default function CompactListBlock({
  lang,
  title,
  href,
  sectionKey,
  cards,
  tone = "light",
  showTime = true,
}: {
  lang: "ar" | "en";
  title: string;
  href: string;
  sectionKey?: string;
  cards: ArticleCardType[];
  tone?: "light" | "dark";
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

  return (
    <section className={`${tone === "dark" ? "bg-navy" : "bg-paper"} py-8`}>
      <div className="mx-auto max-w-container px-6">
        <SectionHeading lang={lang} title={title} href={href} sectionKey={sectionKey} tone={tone} />

        {/* columns, not a grid: a two-column grid orders items across the row
            (1,2 / 3,4), which reads wrong for a ranked list in any language.
            CSS columns keep 1,2,3 down the first column — and inherit the
            page's direction, so the first column is the RIGHT one in RTL
            without a single directional property. */}
        <ol className="m-0 list-none p-0 sm:columns-2 sm:gap-x-10">
          {cards.map((a, i) => (
            <li key={a.id} className="break-inside-avoid">
              <Link
                href={articleHref(a, lang)}
                className="card-link flex items-baseline gap-3 border-b border-line py-2.5 no-underline"
              >
                <span
                  aria-hidden
                  className={`tnum w-5 flex-shrink-0 text-[13px] font-extrabold ${
                    tone === "dark" ? "text-header-muted" : "text-brand"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`${fontDisplay} card-title block text-[15px] font-bold leading-[1.55] ${
                      tone === "dark" ? "text-paper" : "text-ink"
                    }`}
                  >
                    {a.title}
                  </span>
                  {showTime && (
                    <TimeAgo
                      iso={a.published_at}
                      lang={lang}
                      className={`mt-1 block text-xs ${tone === "dark" ? "text-header-muted" : "text-ink-3"}`}
                    />
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <SectionMore lang={lang} href={href} tone={tone} />
      </div>
    </section>
  );
}
