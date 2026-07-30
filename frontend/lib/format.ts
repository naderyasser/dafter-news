export function relativeTime(iso: string | null | undefined, lang: "ar" | "en"): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.max(0, Math.round((now - then) / 60000));
  const isAr = lang === "ar";
  if (diffMin < 1) return isAr ? "الآن" : "just now";
  if (diffMin < 60) return isAr ? `منذ ${diffMin} دقيقة` : `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return isAr ? (diffHr === 1 ? "منذ ساعة" : `منذ ${diffHr} ساعات`) : `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 2) return isAr ? "أمس" : "Yesterday";
  return isAr ? `منذ ${diffDay} أيام` : `${diffDay}d ago`;
}

/**
 * The day a story belongs to, as a heading — «اليوم», «أمس», then the date.
 *
 * The politics and courts fronts hang their stories on a dated spine, which
 * only carries meaning if consecutive stories from the same day sit under one
 * heading. Comparing calendar days rather than elapsed hours is the point: a
 * story filed at 23:50 and one filed at 00:10 are eight hours of "yesterday"
 * apart to `relativeTime` and two different days to a reader.
 *
 * Undated drafts sort to the top under «الأحدث» rather than inventing a date
 * for them — the section page renders whatever the API returns, and one desk
 * currently has nothing but an unpublished story.
 */
export function dayBucket(iso: string | null | undefined, lang: "ar" | "en"): string {
  const isAr = lang === "ar";
  if (!iso) return isAr ? "الأحدث" : "Latest";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return isAr ? "الأحدث" : "Latest";
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(then)) / 86400000);
  if (days <= 0) return isAr ? "اليوم" : "Today";
  if (days === 1) return isAr ? "أمس" : "Yesterday";
  return new Intl.DateTimeFormat(isAr ? "ar-EG" : "en-US", { day: "numeric", month: "long" }).format(then);
}

/** Clock time for a spine entry — «١٤:٢٠». Empty for an undated story. */
export function clockTime(iso: string | null | undefined, lang: "ar" | "en"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // h23, not `hour12: false` — the latter resolves to the h24 cycle, where
  // midnight is written «٢٤:٠٤» instead of «٠٠:٠٤». Every story filed in the
  // small hours would have carried a time that does not exist.
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

export function formatDate(iso: string | null | undefined, lang: "ar" | "en"): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

const EASTERN = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
export const toEasternNumerals = (n: number | string) => String(n).split("").map((d) => (EASTERN[+d] ?? d)).join("");

/**
 * The standfirst, but only when it says something the headline didn't.
 *
 * 61 of the 63 published stories carry a standfirst that is character-for-
 * character the headline — the dashboard pre-fills it and most editors leave
 * it. Every card that printed both therefore printed the same sentence twice,
 * which is the single loudest "this page was generated" tell on the site.
 *
 * The prefix test catches the other common shape: a standfirst that is the
 * headline cut short, or the headline plus a trailing clause the card would
 * clamp away anyway. Punctuation and كشيدة are stripped before comparing so a
 * stray full stop does not make two identical sentences look different.
 */
export function standfirstFor(title: string, standfirst?: string | null): string | undefined {
  if (!standfirst) return undefined;
  const norm = (s: string) =>
    s
      .replace(/ـ/g, "")
      .replace(/[\s‏‎]+/g, " ")
      .replace(/[.،؟!:؛…"'«»]/g, "")
      .trim();
  const a = norm(standfirst);
  const b = norm(title);
  if (!a) return undefined;
  if (a === b || a.startsWith(b) || b.startsWith(a)) return undefined;
  return standfirst;
}

/**
 * The headline with its own section's name stripped off the front.
 *
 * «دليلك الأول» files every guide as «دليلك الأول: تجديد رخصة القيادة», which
 * is right in a mixed feed and pure noise on the section's own page — four
 * headlines opening with the same three words, above a masthead already
 * saying them. Removing the prefix there is what makes the column scannable.
 *
 * Only an exact section-name match followed by a separator is removed, so a
 * headline that merely starts with a similar word keeps every character.
 */
export function withoutSectionPrefix(title: string, sectionTitle?: string): string {
  if (!sectionTitle) return title;
  const trimmed = title.trimStart();
  if (!trimmed.startsWith(sectionTitle)) return title;
  const rest = trimmed.slice(sectionTitle.length);
  const stripped = rest.replace(/^\s*[:：–—-]\s*/, "");
  // No separator means the name is part of the sentence, not a label on it.
  return stripped === rest ? title : stripped || title;
}

/**
 * Fully decode a route param that may be percent-encoded more than once.
 *
 * Arabic slugs (see Article.save() / Tag.slug) arrive encoded, and passing
 * the request through middleware re-encodes the pathname — so a single
 * decodeURIComponent leaves `%D8%A7...` behind and every slug comparison
 * silently fails (which is what made /tag/<arabic> render its own encoded
 * slug as the heading). Decode until the value stops changing.
 */
export function decodeParam(value: string): string {
  let out = value;
  for (let i = 0; i < 5; i++) {
    let next: string;
    try {
      next = decodeURIComponent(out);
    } catch {
      return out; // malformed escape — keep what we have
    }
    if (next === out) return out;
    out = next;
  }
  return out;
}
