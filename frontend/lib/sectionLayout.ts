/**
 * Which front each section page wears — the client's «تصميم فريد لكل قسم»,
 * taken literally the second time of asking.
 *
 * The first pass shared four archetypes across thirteen desks and told them
 * apart by an accent colour and a watermark. Read back, that is one page
 * thirteen times: same coloured band, same lead photo, same run of rows. The
 * client's note was blunt about it, so every desk now has its own component
 * under components/site/fronts — its own masthead, its own grid, its own
 * structural device.
 *
 * What keeps this from becoming thirteen unrelated websites: the fronts share
 * the shell, the tokens and the type ramp, and each one is a *layout* only.
 * Data fetching, SEO, ads and the aside stay in the page, so a shared concern
 * still lands in one place rather than thirteen.
 *
 * The device each front is built around is not decoration — it is the thing
 * that desk actually deals in. Politics deals in dated statements, so it gets
 * a chronicle. Courts deal in cases, so they get a docket. Markets deal in
 * numbers, so the numbers are the hero. A desk whose device would be a lie
 * (a governorate rail over stories with no governorate) does not get one.
 */

/** The component that renders the section's body. One per desk. */
export type FrontKey =
  | "politics"
  | "egypt"
  | "gulf"
  | "world"
  | "markets"
  | "sports"
  | "security"
  | "tech"
  | "culture"
  | "special"
  | "guide"
  | "watch"
  | "opinion"
  /** Anything created in the dashboard later — never a blank page. */
  | "newswire";

/** Extra data a front needs beyond the section's own stories. */
export type FrontFeed = "markets" | "matches" | "videos" | null;

export type SectionFront = {
  front: FrontKey;
  feed: FrontFeed;
  /**
   * Whether the «الأكثر قراءة» rail sits beside the front.
   *
   * Three desks refuse it. The screening room and the cinema stage are dark
   * full-bleed surfaces and a white column beside them reads as a rendering
   * fault; the op-ed page is a measured single column of argument and a
   * popularity list next to it argues with the whole point of the page.
   */
  aside: boolean;
};

const FRONTS: Record<string, SectionFront> = {
  pol: { front: "politics", feed: null, aside: true },
  egypt: { front: "egypt", feed: null, aside: true },
  gulf: { front: "gulf", feed: null, aside: true },
  world: { front: "world", feed: null, aside: true },
  economy: { front: "markets", feed: "markets", aside: true },
  sports: { front: "sports", feed: "matches", aside: true },
  security: { front: "security", feed: null, aside: true },
  tech: { front: "tech", feed: null, aside: true },
  art: { front: "culture", feed: null, aside: true },
  guide: { front: "guide", feed: null, aside: true },
  special: { front: "special", feed: null, aside: false },
  video: { front: "watch", feed: "videos", aside: false },
  opinion: { front: "opinion", feed: null, aside: false },
};

export function sectionFront(key?: string | null): SectionFront {
  return (key && FRONTS[key]) || { front: "newswire", feed: null, aside: true };
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
