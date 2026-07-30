/**
 * How each section page is laid out — the client's «تصميم فريد لكل قسم».
 *
 * The differentiation is driven by what a section IS, not by decoration.
 * «حركة السوق» opens with live prices because prices are its subject;
 * «جوّه الجون» opens with fixtures; «لقطة وتعليق» with a player. Sections
 * whose subject is simply news share the newswire archetype and are told
 * apart by the colour and line-art mark they already carry (lib/sections).
 *
 * Thirteen bespoke page components were the alternative. They would have
 * meant thirteen places to change when a shared concern lands (ads, an
 * infinite feed, comments), and thirteen chances for the paper to stop
 * looking like one paper.
 */

/** The grid the section's stories fall into below its opening module. */
export type SectionArchetype =
  /** Dense and time-ordered: a lead, then a run of compact rows. Fast news. */
  | "newswire"
  /** Lead + rail + tiles, filterable by country. The geographic desks. */
  | "geographic"
  /** Poster cards, big type, bylines forward. Long-form and guides. */
  | "magazine";

/** An extra block rendered above the grid, fed by its own data. */
export type SectionTopModule = "markets" | "matches" | "videos" | "columnists" | null;

type SectionLayout = { archetype: SectionArchetype; top: SectionTopModule };

const LAYOUT: Record<string, SectionLayout> = {
  // Subject-led: each opens with the thing the section is actually about.
  economy: { archetype: "newswire", top: "markets" },
  sports: { archetype: "newswire", top: "matches" },
  video: { archetype: "magazine", top: "videos" },
  opinion: { archetype: "magazine", top: "columnists" },

  // Geographic desks — the country chips become a real filter here.
  gulf: { archetype: "geographic", top: null },
  world: { archetype: "geographic", top: null },

  // Long-form and service journalism.
  special: { archetype: "magazine", top: null },
  art: { archetype: "magazine", top: null },
  guide: { archetype: "magazine", top: null },

  // Fast news.
  pol: { archetype: "newswire", top: null },
  egypt: { archetype: "newswire", top: null },
  security: { archetype: "newswire", top: null },
  tech: { archetype: "newswire", top: null },
};

/** A section added in the dashboard gets the newswire grid — never a blank page. */
export function sectionLayout(key?: string | null): SectionLayout {
  return (key && LAYOUT[key]) || { archetype: "newswire", top: null };
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
