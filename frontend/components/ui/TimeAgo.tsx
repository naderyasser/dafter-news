import { relativeTime } from "@/lib/format";

/**
 * The one relative-time stamp on the site — «قبل ٣ ساعات», «أمس» — wrapped
 * in a real <time datetime> so the machine-readable instant travels with the
 * human-readable phrase (SEO, and a screen reader that would otherwise read
 * a bare fragment with no anchor).
 *
 * Renders NOTHING when there is no timestamp, rather than an empty element:
 * a card whose story has never been published has no time to state, and an
 * empty <time> is worse than an absent one for both of the readers above.
 *
 * The visible text comes from lib/format's relativeTime, which every other
 * surface already uses — this component exists so the <time> wrapper and the
 * 12px muted treatment can't drift card by card, not to introduce a second
 * way of phrasing elapsed time.
 */
export default function TimeAgo({
  iso,
  lang,
  className = "",
}: {
  iso?: string | null;
  lang: "ar" | "en";
  className?: string;
}) {
  if (!iso) return null;
  const label = relativeTime(iso, lang);
  if (!label) return null;

  return (
    <time dateTime={iso} className={`tnum ${className}`}>
      {label}
    </time>
  );
}
