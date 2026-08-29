/**
 * The Arabic locale every formatter on the site uses.
 *
 * `-u-nu-latn` is the whole point: it keeps Arabic month and weekday names
 * («أغسطس», «الجمعة») while forcing Western digits. Plain AR_LOCALE gives
 * Eastern digits (٢٠٢٦), which the newsroom asked to drop everywhere —
 * readers here are used to 2026, and mixed digit systems across a page
 * (Eastern in a date, Western in a view count) read as a bug either way.
 *
 * One constant rather than the string repeated at each call site, so the
 * next change to this decision is one line.
 */
export const AR_LOCALE = "ar-EG-u-nu-latn";

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
  return new Intl.DateTimeFormat(isAr ? AR_LOCALE : "en-US", { day: "numeric", month: "long" }).format(then);
}

/** Clock time for a spine entry — «١٤:٢٠». Empty for an undated story. */
export function clockTime(iso: string | null | undefined, lang: "ar" | "en"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // h23, not `hour12: false` — the latter resolves to the h24 cycle, where
  // midnight is written «٢٤:٠٤» instead of «٠٠:٠٤». Every story filed in the
  // small hours would have carried a time that does not exist.
  return new Intl.DateTimeFormat(lang === "ar" ? AR_LOCALE : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

export function formatDate(iso: string | null | undefined, lang: "ar" | "en"): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(lang === "ar" ? AR_LOCALE : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

/**
 * The full "نُشر في ..." publish line under a story's headline — day name,
 * full date and a 12-hour clock with ص/م, matching the newsroom's own
 * reference example for how a publish date should read. Not used for the
 * compact dates elsewhere (front-page cards, dashboard tables) — those stay
 * as `formatDate` prints them; this is only the article/opinion byline row.
 *
 * Built from three separate Intl calls rather than one combined
 * weekday+date format: Intl's own combined form inserts a comma after the
 * weekday («الأربعاء، ١٢ أغسطس») which reads one comma too many next to the
 * reference example («الأربعاء ١٢ أغسطس... ، ١٠:٣٠ م» — comma only before
 * the time).
 */
export function publishedLine(iso: string | null | undefined, lang: "ar" | "en"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const isAr = lang === "ar";
  const locale = isAr ? AR_LOCALE : "en-US";
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(d);
  const rest = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  return isAr ? `نُشر في ${weekday} ${rest}، ${time}` : `Published ${weekday}, ${rest}, ${time}`;
}

/**
 * Which script a string is written in.
 *
 * The site has columns that hold both languages — a story rail's title, a
 * video's title, a tag's name — with no language column beside them, so each
 * edition decides what belongs to it by looking at the characters. Both
 * home pages, the sitemap, the English video page and the welcome toast had
 * each written this same regex privately; one definition means a change to
 * what counts as Arabic can't apply to four of the five.
 *
 * U+0600–U+06FF is the Arabic block, which covers the letters and the
 * Eastern digits this newsroom writes in. `isLatinScript` is deliberately
 * "not Arabic" rather than a Latin range test: a headline of digits and
 * punctuation belongs to the English edition, and would fail a positive
 * A–Z test.
 */
export const isArabicScript = (text: string) => /[؀-ۿ]/.test(text);
export const isLatinScript = (text: string) => !isArabicScript(text);


/**
 * Digits as the site prints them: Western, in both editions.
 *
 * Kept as a function rather than deleted at the call sites because it is the
 * one place the decision lives — if Eastern numerals are ever wanted back,
 * this returns them again and every counter follows.
 */
export const toDisplayNumerals = (n: number | string) => String(n);

/**
 * A story's read count, as «الأكثر قراءة» prints it beside the eye mark.
 *
 * The list ranks by reads, but every row showed only a timestamp — so the
 * ordering looked like a broken chronological sort, which is exactly how the
 * newsroom read it. Printing the number the ranking is actually built on is
 * what makes the order explain itself.
 *
 * Arabic counts its nouns by the *last two digits*, and getting it wrong is
 * conspicuous in a newsroom: ٣–١٠ take the plural (٥ قراءات), ١١ and above
 * take the singular (١٥٠ قراءة), and one and two have their own forms rather
 * than a digit at all — «قراءة واحدة», not «١ قراءة». Hence the tail test on
 * `n % 100`: 103 reads is «١٠٣ قراءات» while 111 is «١١١ قراءة».
 *
 * AR_LOCALE for the thousands mark, matching formatDate and the rest of this
 * file, so the count sits in the same number system as every other figure on
 * the page.
 */
export function readCount(views: number | null | undefined, lang: "ar" | "en"): string {
  const n = Math.max(0, Math.floor(Number(views) || 0));
  if (lang !== "ar") return `${n.toLocaleString("en-US")} ${n === 1 ? "read" : "reads"}`;
  if (n === 1) return "قراءة واحدة";
  if (n === 2) return "قراءتان";
  const num = new Intl.NumberFormat(AR_LOCALE).format(n);
  const tail = n % 100;
  return tail >= 3 && tail <= 10 ? `${num} قراءات` : `${num} قراءة`;
}

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
