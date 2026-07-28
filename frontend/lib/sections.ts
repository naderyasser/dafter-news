/**
 * Per-section visual identity: an accent colour and a subject watermark.
 *
 * Why a map and not Tailwind tokens: section keys come from the API, so a
 * class name like `text-section-${key}` would never survive Tailwind's JIT
 * scan (it only sees literal strings in source). These feed CSS custom
 * properties instead, which are set inline and read by `.rule-accent` and
 * `.section-watermark` in globals.css.
 *
 * Every colour here clears 4.5:1 on paper white, because the section name is
 * rendered in it as the kicker above each card headline — this is body text,
 * not decoration. Re-check with the contrast script before adding one.
 *
 * A section with no entry falls back to the accent blue and gets no
 * watermark, so adding a section in the dashboard is never a broken block.
 */

export type SectionIdentity = {
  /** Drives the heading rule's second tone, the card kicker and the hover. */
  color: string;
  /** Inline SVG for the block's background mark; omitted = no mark. */
  art?: string;
  /** Overrides for the default watermark placement. */
  size?: string;
  position?: string;
  opacity?: number;
};

/**
 * Line-art marks, drawn at 200×120 and stroked in the section's own colour.
 * They are deliberately open outlines rather than filled shapes: at the
 * opacity a watermark has to sit at, a fill turns into a grey smudge while a
 * stroke still reads as the thing it depicts.
 */
const ART = {
  // ملعب كرة قدم — «جوّه الجون»
  pitch: `<rect x="6" y="6" width="188" height="108" rx="2"/><path d="M100 6v108"/><circle cx="100" cy="60" r="20"/><path d="M6 34h30v52H6M194 34h-30v52h30"/><path d="M6 48h12v24H6M194 48h-12v24h12"/>`,
  // شارت صاعد — «حركة السوق»
  chart: `<path d="M14 106h176M14 106V14"/><path d="M30 88l34-26 30 18 34-40 42-22"/><path d="M154 18h16v16"/><path d="M40 106V78M70 106V88M100 106V66M130 106V84M160 106V52"/>`,
  // لوحة رسّام — «ثقافة وفن»
  palette: `<path d="M100 16c-40 0-72 22-72 48 0 20 18 34 40 34 10 0 14 6 14 12 0 8 8 14 18 14 40 0 72-26 72-56S140 16 100 16z"/><circle cx="68" cy="52" r="9"/><circle cx="100" cy="40" r="9"/><circle cx="132" cy="52" r="9"/><circle cx="142" cy="82" r="9"/>`,
  // كرة أرضية — «عرب وعالم»
  globe: `<circle cx="100" cy="60" r="46"/><path d="M100 14v92M54 60h92"/><ellipse cx="100" cy="60" rx="22" ry="46"/><path d="M62 34c22 12 54 12 76 0M62 86c22-12 54-12 76 0"/>`,
  // دائرة كهربية — «علوم وتكنولوجيا»
  circuit: `<rect x="70" y="42" width="60" height="36" rx="4"/><path d="M70 52H34V26M70 68H34v26M130 52h36V26M130 68h36v26"/><circle cx="34" cy="22" r="5"/><circle cx="34" cy="98" r="5"/><circle cx="166" cy="22" r="5"/><circle cx="166" cy="98" r="5"/><path d="M88 60h24"/>`,
  // ميزان العدل — «أمن ومحاكم». Arc flags are written out with separators
  // rather than in the compact `a18 12 0 0036 0` form: it is legal SVG, but
  // enough renderers mis-split the two flag digits that the pans silently
  // vanish and the mark degrades to a bare post.
  scales: `<path d="M100 18v84M74 102h52M52 40h96"/><circle cx="100" cy="34" r="6"/><path d="M52 40 L 34 76 a 18 12 0 0 0 36 0 Z M148 40 l 18 36 a 18 12 0 0 1 -36 0 Z"/>`,
  // بوصلة — «دليلك الأول»
  compass: `<circle cx="100" cy="60" r="44"/><circle cx="100" cy="60" r="34"/><path d="M116 44l-9 25-25 9 9-25z"/><circle cx="100" cy="60" r="3"/><path d="M100 12v10M100 98v10M48 60H38M162 60h-10"/>`,
  // ملف مستندات — «ملف خاص»
  folder: `<path d="M28 40 h44 l10 12 h90 v56 a 6 6 0 0 1 -6 6 H34 a 6 6 0 0 1 -6 -6 Z"/><path d="M28 40 v-6 a 6 6 0 0 1 6 -6 h32 a 6 6 0 0 1 6 6 v6"/><path d="M58 72 h84 M58 88 h60"/>`,
  // نجمة — «ستايل ونجوم»
  star: `<path d="M100 14l16 34 38 5-27 26 6 37-33-18-33 18 6-37-27-26 38-5z"/><path d="M40 96l4 10 10 4-10 4-4 10-4-10-10-4 10-4zM158 24l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/>`,
  // أهرامات — «شؤون مصر»
  pyramids: `<path d="M18 100h164"/><path d="M66 100L30 100 66 34l36 66H66z"/><path d="M132 100l-30 0 30-48 30 48h-30z"/><path d="M46 100l20-38 20 38"/><circle cx="152" cy="30" r="10"/>`,
  // شراع مركب — «الخليج العربي»
  dhow: `<path d="M14 96h172"/><path d="M22 96c26 12 130 12 156 0"/><path d="M100 14v72M100 20l52 60h-52M100 34L58 80h42"/><path d="M14 108c26 8 146 8 172 0"/>`,
  // زر تشغيل — «لقطة وتعليق»
  play: `<rect x="20" y="18" width="160" height="84" rx="10"/><path d="M86 44l34 18-34 18z"/><path d="M20 34h160M40 18v16M64 18v16M136 18v16M160 18v16"/>`,
  // علامة اقتباس — «بالعقل والمنطق»
  quote: `<path d="M64 88c-16 0-28-12-28-28 0-22 16-40 38-46l6 12c-14 5-22 14-22 24h6c14 0 24 10 24 22s-10 16-24 16z"/><path d="M136 88c-16 0-28-12-28-28 0-22 16-40 38-46l6 12c-14 5-22 14-22 24h6c14 0 24 10 24 22s-10 16-24 16z"/>`,
} as const;

export const SECTION_IDENTITY: Record<string, SectionIdentity> = {
  egypt: { color: "#0E4B7B", art: ART.pyramids },
  gulf: { color: "#0B6B6A", art: ART.dhow },
  world: { color: "#1A5F99", art: ART.globe },
  economy: { color: "#8A6410", art: ART.chart },
  // The client's worked example: «درجات اللون الأخضر لقسم الرياضة» over a pitch.
  sports: { color: "#12793F", art: ART.pitch },
  security: { color: "#41556E", art: ART.scales },
  tech: { color: "#0E7490", art: ART.circuit },
  art: { color: "#7A3E9D", art: ART.palette },
  // The only section that keeps the brand red: a «ملف خاص» is the paper
  // speaking in its own voice, so it wears the masthead's colour.
  special: { color: "#B01F2E", art: ART.folder },
  guide: { color: "#B45309", art: ART.compass },
  video: { color: "#2F3A45", art: ART.play },
  opinion: { color: "#073252", art: ART.quote },
};

/** Accent blue — the fallback for any section without its own entry. */
export const ACCENT = "#0E4B7B";

export function sectionColor(key?: string | null): string {
  return (key && SECTION_IDENTITY[key]?.color) || ACCENT;
}

/**
 * CSS custom properties for a section block: the rule's second tone plus the
 * watermark. Spread onto a `style` prop.
 *
 * The SVG is inlined as a data URI rather than served from /public so the
 * stroke can carry the section's colour — one file per section per colour
 * would otherwise be needed, and a greyscale mark under a green heading looks
 * like a rendering fault rather than a choice.
 */
/**
 * The section's line-art mark as a standalone data URI, stroked in a caller-
 * chosen colour. The watermark variant above always strokes in the section's
 * own colour at 3px for big faint backgrounds; the drawer tiles need the same
 * drawing small, bright and on navy — so stroke colour and weight are theirs
 * to pick. Returns null for a section without art so callers can skip the
 * element entirely.
 */
export function sectionArtUrl(key: string | null | undefined, stroke: string, strokeWidth = 7): string | null {
  const identity = key ? SECTION_IDENTITY[key] : undefined;
  if (!identity?.art) return null;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120" fill="none" ` +
    `stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">` +
    `${identity.art}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function sectionStyle(key?: string | null): React.CSSProperties {
  const color = sectionColor(key);
  const identity = key ? SECTION_IDENTITY[key] : undefined;
  const style: Record<string, string> = { "--rule-b": color };

  if (identity?.art) {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120" fill="none" ` +
      `stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">` +
      `${identity.art}</svg>`;
    style["--wm-image"] = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    style["--wm-opacity"] = String(identity.opacity ?? 0.07);
    if (identity.size) style["--wm-size"] = identity.size;
    if (identity.position) style["--wm-position"] = identity.position;
  }

  return style as React.CSSProperties;
}
