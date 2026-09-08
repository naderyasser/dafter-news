/**
 * Which front each section page wears.
 *
 * Two client notes, a year apart, pulled this in opposite directions. The
 * first («تصميم فريد لكل قسم») gave every desk its own component under
 * components/site/fronts — its own masthead, its own grid, its own
 * structural device. The second (2026-09-09) looked at the result and asked
 * for the opposite: an organised, responsive grid, no dark overlays, the same
 * card everywhere. So every article desk now wears `news` (NewsGridFront),
 * and what tells the desks apart is the accent, the tagline and — for the two
 * desks whose masthead is data — that masthead.
 *
 * What stays true from the first pass: the fronts share the shell, the
 * tokens and the type ramp, and each one is a *layout* only. Data fetching,
 * SEO, ads and the aside stay in the page, so a shared concern still lands
 * in one place.
 */

/** The component that renders the section's body. */
export type FrontKey =
  /** Every article desk, and anything created in the dashboard later. */
  | "news"
  /** «حركة السوق» — the price board over the news body. */
  | "markets"
  /** «جوّه الجون» — the pitch and fixtures over the news body. */
  | "sports"
  /** «لقطة وتعليق» — the video table; its own page. */
  | "watch"
  /** «بالعقل والمنطق» — the columnists; its own page. */
  | "opinion";

/** Extra data a front needs beyond the section's own stories. */
export type FrontFeed = "markets" | "matches" | "videos" | null;

export type SectionFront = {
  front: FrontKey;
  feed: FrontFeed;
  /**
   * Whether the «الأكثر قراءة» rail sits beside the front.
   *
   * Two desks refuse it. The screening room is a dark full-bleed surface and a
   * white column beside it reads as a rendering fault; the op-ed page is a
   * measured single column of argument and a popularity list next to it
   * argues with the whole point of the page.
   */
  aside: boolean;
};

const NEWS: SectionFront = { front: "news", feed: null, aside: true };

const FRONTS: Record<string, SectionFront> = {
  pol: NEWS,
  egypt: NEWS,
  gulf: NEWS,
  world: NEWS,
  economy: { front: "markets", feed: "markets", aside: true },
  sports: { front: "sports", feed: "matches", aside: true },
  security: NEWS,
  tech: NEWS,
  art: NEWS,
  guide: NEWS,
  special: NEWS,
  video: { front: "watch", feed: "videos", aside: false },
  opinion: { front: "opinion", feed: null, aside: false },
};

export function sectionFront(key?: string | null): SectionFront {
  return (key && FRONTS[key]) || NEWS;
}

/**
 * One line of editorial voice under each section's masthead. Copy, not
 * decoration — it tells a first-time reader what the desk covers, which is
 * also why a dashboard-created section simply gets none rather than a
 * generated platitude.
 */
const TAGLINE: Record<string, { ar: string; en: string }> = {
  pol: { ar: "قراءة في القرار والموقف — من البرلمان إلى عواصم صنع السياسة", en: "The decisions, and the positions behind them." },
  egypt: { ar: "أخبار المحروسة أولاً بأول — من المحليات إلى القرارات الكبرى", en: "Egypt's news as it happens, street level to state level." },
  gulf: { ar: "من الرياض إلى مسقط.. اقتصاد الخليج وسياساته وناسه", en: "From Riyadh to Muscat — the Gulf's economy, politics and people." },
  world: { ar: "ما يجري خارج الحدود ويعنيك — من العواصم العربية والعالمية", en: "What happens beyond the border — and why it matters here." },
  economy: { ar: "العملات والذهب والبورصة.. الأرقام أولاً ثم التحليل", en: "Currencies, gold and the exchange — numbers first, then the story." },
  sports: { ar: "من قلب الملعب: النتائج والتحليلات وكواليس الكورة", en: "From inside the pitch: results, analysis, and the game behind the game." },
  security: { ar: "وقائع وتحقيقات وأحكام — من قاعة المحكمة إلى الشارع", en: "Cases, investigations and verdicts, courtroom to street." },
  tech: { ar: "الجديد في العلم والتقنية — وما الذي يعنيه لحياتك", en: "What's new in science and tech — and what it means for you." },
  art: { ar: "المسرح والسينما والكتاب والمعارض.. نبض الحياة الثقافية", en: "Stage, screen, books and galleries — the cultural pulse." },
  special: { ar: "تحقيقات معمّقة تأخذ وقتها — الصحافة حين تحفر", en: "In-depth investigations that take their time." },
  guide: { ar: "خدمات وإرشادات عملية تبسّط يومك", en: "Practical service journalism that simplifies your day." },
  video: { ar: "الحكاية كما تُروى بالصورة — تقارير ولقطات وتعليق", en: "The story, told in pictures." },
  opinion: { ar: "كتّابنا يقرأون ما وراء الخبر", en: "Our columnists read behind the news." },
};

export function sectionTagline(key: string | null | undefined, lang: "ar" | "en"): string | undefined {
  return key ? TAGLINE[key]?.[lang] : undefined;
}
