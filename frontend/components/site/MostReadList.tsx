import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";
import { articleCoverFallback } from "@/lib/coverFallback";
import { toDisplayNumerals } from "@/lib/format";

/** Rank numeral. Western digits in both editions — see lib/format's
 *  AR_LOCALE for why the site dropped Eastern numerals everywhere. This
 *  file used to carry its own private digit table, which is exactly how a
 *  site ends up with two number systems on one page. */
const toRank = (n: number) => toDisplayNumerals(n);

/**
 * The caption is the section name alone — neither a timestamp nor a read count.
 *
 * Time was dropped first: the list ranks by read count, so a relative timestamp
 * was the one visible fact the ordering ignores, and it read as a broken
 * chronological sort. The read count that replaced it is now gone too, at the
 * newsroom's request — the raw numbers are small enough on a young site that
 * printing them undersells the stories. The rank digit already carries the
 * order, and `views` stays on the type because callers still pass it.
 */
export type MostReadItem = {
  title: string;
  href: string;
  section?: string;
  views?: number;
  /** May be null/undefined (no cover) or a URL that no longer resolves —
   *  both fall to articleCoverFallback rather than an empty grey slot. */
  imageSrc?: string | null;
  kind?: "news" | "opinion";
  authorAvatar?: string | null;
};

export default function MostReadList({
  lang,
  items,
  heading,
}: {
  lang: "ar" | "en";
  items: MostReadItem[];
  heading?: string;
}) {
  const isAr = lang === "ar";
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  return (
    <aside className="rounded-card border border-line bg-paper p-5">
      <div className={`${fontDisplay} rule-accent ps-3.5 text-[17px] font-extrabold text-ink`}>
        {heading ?? (isAr ? "الأكثر قراءة" : "Most read")}
      </div>
      <div className="flex flex-col">
        {items.map((it, i) => (
          <Link
            key={it.href + i}
            href={it.href}
            className={`flex items-start gap-3.5 py-3.5 no-underline ${i === items.length - 1 ? "" : "border-b border-line"}`}
          >
            <span className="tnum min-w-[28px] flex-shrink-0 text-[26px] font-extrabold leading-none text-brand">
              {toRank(i + 1)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[14px] font-semibold leading-[1.5] text-ink">{it.title}</span>
              {it.section && (
                <span className="tnum flex flex-wrap items-center gap-x-1.5 text-caption text-ink-3">
                  {it.section}
                </span>
              )}
            </span>
            {/* Thumbnail sits at the inline end so the rank column stays the
                reading anchor and the numbers line up down the list. */}
            {/* 68×52 slot (sizes="68px": the raw cover behind it is up to
                470KB, and five of them made this sidebar the heaviest thing
                on the page). No src, or a src that 404s, falls to the
                article fallback — the site mark, or the columnist's own
                portrait for an opinion piece — never to an empty grey box. */}
            <CoverImage
              src={it.imageSrc}
              alt=""
              placeholder=""
              sizes="68px"
              className="relative h-[52px] w-[68px] flex-shrink-0 rounded"
              fallbackSrc={articleCoverFallback(it.kind, it.authorAvatar).src}
              fallbackFit={articleCoverFallback(it.kind, it.authorAvatar).fit}
              position={articleCoverFallback(it.kind, it.authorAvatar).position}
            />
          </Link>
        ))}
      </div>
    </aside>
  );
}
