import Link from "next/link";

import type { TrendingTag } from "@/lib/types";

const T = {
  ar: { heading: "وسوم رائجة", caption: "الأكثر تداولاً في أخبار الشهر", hot: "رائج الآن", stories: "خبر" },
  en: { heading: "Trending tags", caption: "Most used in this month's stories", hot: "Trending now", stories: "stories" },
};

/** A small flame — the "high velocity" mark. Drawn inline so it can take the
 *  pill's current colour on hover. */
function Flame({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false" className={className}>
      <path d="M12.5 2c.4 3.2-1 5.1-2.6 6.8C8.3 10.5 7 12.1 7 14.6 7 18 9.4 21 12.6 21c3.3 0 5.4-2.5 5.4-5.8 0-2.5-1.3-4.4-2.6-5.7.2 1.7-.5 2.9-1.6 3.4.5-2.6-.4-6.2-1.3-7.4Z" />
    </svg>
  );
}

/**
 * «وسوم رائجة» — the tag cloud beside «الأكثر قراءة».
 *
 * Fed by /api/tags/trending/ (see lib/api's getTrendingTags): tags ranked by
 * how many stories carried them recently, with this week counting extra.
 * The block used to slice the first five tags of the plain list, whose
 * order is alphabetical, which is why the newsroom saw the same five
 * hashtags for weeks — "static" was the honest description of a list that
 * never depended on what was being published.
 *
 * Pills, each with its story count; the backend's `is_hot` call adds a flame
 * and a tinted fill, so a reader can tell a tag that is genuinely moving
 * from one that is merely present. Hidden entirely when nothing has been
 * tagged in the window — an empty box under a heading is the one thing
 * every block on this page refuses to be.
 */
export default function TrendingTags({ lang, tags, heading }: { lang: "ar" | "en"; tags: TrendingTag[]; heading?: string }) {
  if (!tags.length) return null;
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const href = (tag: TrendingTag) => (isAr ? `/tag/${tag.slug}` : `/en/tag/${encodeURIComponent(tag.slug)}`);

  return (
    <aside className="rounded-card border border-line bg-paper p-5">
      <div className="rule-accent ps-3.5">
        <div className={`${fontDisplay} text-[15px] font-extrabold text-ink`}>{heading ?? t.heading}</div>
        <div className="mt-0.5 text-[12px] text-ink-3">{t.caption}</div>
      </div>
      <ul className="m-0 mt-3.5 flex list-none flex-wrap gap-2 p-0">
        {tags.map((tag) => (
          <li key={tag.id}>
            <Link
              href={href(tag)}
              title={tag.is_hot ? t.hot : undefined}
              className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold no-underline transition-all duration-fast hover:-translate-y-px hover:border-brand hover:bg-brand hover:text-paper hover:shadow-1 ${
                tag.is_hot ? "border-brand/30 bg-brand-tint text-brand" : "border-line bg-surface text-ink-2"
              }`}
            >
              {tag.is_hot && <Flame className="h-3.5 w-3.5 flex-shrink-0 text-brand transition-colors duration-fast group-hover:text-paper" />}
              <span>{tag.name}</span>
              <span
                className="tnum rounded-full bg-paper px-1.5 py-px text-[11px] font-bold text-ink-3 transition-colors duration-fast group-hover:bg-white/20 group-hover:text-paper"
                aria-label={`${tag.article_count} ${t.stories}`}
              >
                {tag.article_count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
