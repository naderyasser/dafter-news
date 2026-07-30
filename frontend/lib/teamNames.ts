/**
 * Arabic names for the clubs, grounds and competitions the fixtures feed
 * returns in English only.
 *
 * TheSportsDB has no Arabic column, so an unmapped Arabic page would print
 * "Ghazl El Mahalla" beside «الجولة 13». This lived inside MatchesRail until
 * «جوّه الجون» grew its own scoreboard and immediately reproduced the bug it
 * had already fixed once — so the table is shared now and there is one place
 * to add a newly promoted side.
 *
 * Anything unmapped falls through to the English string rather than
 * disappearing: a cup opponent with no entry is still a readable fixture.
 */
const AR_NAMES: Record<string, string> = {
  // clubs
  "al ahly": "الأهلي",
  zamalek: "الزمالك",
  pyramids: "بيراميدز",
  ismaily: "الإسماعيلي",
  "al masry": "المصري",
  "ghazl el mahalla": "غزل المحلة",
  "haras el hodoud": "حرس الحدود",
  enppi: "إنبي",
  smouha: "سموحة",
  "el gouna": "الجونة",
  "ceramica cleopatra": "سيراميكا كليوباترا",
  "future fc": "فيوتشر",
  "modern future": "مودرن فيوتشر",
  "national bank of egypt": "البنك الأهلي",
  pharco: "فاركو",
  zed: "زد",
  "al ittihad alexandria": "الاتحاد السكندري",
  "tala'ea el gaish": "طلائع الجيش",
  "talaea el gaish": "طلائع الجيش",
  "baladiyat el mahalla": "بلدية المحلة",
  petrojet: "بتروجت",
  aswan: "أسوان",
  "eastern company": "الشرقية للدخان",
  // venues
  "el mahalla stadium": "استاد المحلة",
  "cairo international stadium": "استاد القاهرة الدولي",
  "borg el arab stadium": "استاد برج العرب",
  "al salam stadium": "استاد السلام",
  "petro sport stadium": "استاد بتروسبورت",
  // competition
  "egyptian premier league": "الدوري المصري الممتاز",
};

/** The Arabic name for a feed string, or the feed string itself. */
export const arabicName = (value?: string | null) => (value ? AR_NAMES[value.trim().toLowerCase()] ?? value : "");

/** The name to print for a given edition — English pages keep the feed's own. */
export const teamName = (value: string | null | undefined, lang: "ar" | "en") => (lang === "ar" ? arabicName(value) : value ?? "");
