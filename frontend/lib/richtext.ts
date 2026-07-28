/**
 * Reader-comfort helpers for article bodies, plus the inline colour markup the
 * dashboard editor writes.
 *
 * Two separate client asks land here:
 *
 *  - «تجنب الكتل النصية الطويلة … تقسيمها إلى فقرات أقصر» — long paragraphs
 *    are broken at sentence boundaries on the way to the page, so archive
 *    copy that was pasted in as one wall of text reads properly without
 *    anyone re-editing it.
 *  - «فين لو عايز الون خبر او كلام» — the editor needs text and highlight
 *    colours.
 *
 * The colour markup is deliberately NOT HTML. Article bodies are structured
 * blocks with plain-text fields (brief §11: "structured blocks (JSON) وليس
 * HTML خام"), and letting the editor write HTML into them would mean rendering
 * it with dangerouslySetInnerHTML — a stored-XSS hole opened for the sake of
 * two colour pickers. Instead the editor writes a token the parser below turns
 * into React elements, so the worst a malformed value can do is render as
 * literal text.
 */

/** A run of body text, optionally coloured. */
export type Segment = { text: string; color?: string; background?: string };

/** One `kind:#hex|` prefix segment — the building block of a token. */
const PAIR_SRC = "[ch]:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\|";
const PAIR = new RegExp(`([ch]):(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}))\\|`, "g");

/**
 * `{c:#RRGGBB|…}` = text colour, `{h:#RRGGBB|…}` = highlight, and the two can
 * stack on the same run as `{c:#RRGGBB|h:#RRGGBB|…}` — one token, one or more
 * `kind:color|` prefixes, then the text. Stacking is what lets an editor
 * colour a word and then highlight it without re-selecting (see
 * TextColorToolbar's apply()); it has to be one token rather than a nested
 * `{c:…|{h:…|…}}` pair because the inner group below (`[^{}]*`) — deliberately,
 * so stray braces in body text can't be mistaken for markup — cannot match
 * across a nested brace, which used to leak the outer wrapper as literal text.
 */
const INLINE = new RegExp(`\\{((?:${PAIR_SRC})+)([^{}]*)\\}`, "g");

/**
 * One level of `{kind:color|{kind:color|text}}` nesting — the shape a stale
 * textarea selection could produce before apply() started merging into a
 * single token instead — collapsed into the stacked form INLINE understands.
 * Looped so already-published bodies written by the old code render
 * correctly without a data migration.
 */
const NESTED = new RegExp(`\\{((?:${PAIR_SRC})+)\\{((?:${PAIR_SRC})+)([^{}]*)\\}\\}`, "g");

function unnestTokens(text: string): string {
  let out = text;
  for (let i = 0; i < 5; i++) {
    const next = out.replace(NESTED, "{$1$2$3}");
    if (next === out) break;
    out = next;
  }
  return out;
}

export const COLOR_OPEN = (kind: "c" | "h", color: string) => `{${kind}:${color}|`;

/**
 * Re-applying a colour/highlight to a selection that a previous apply() left
 * selected (TextColorToolbar re-selects the just-wrapped text so a colour can
 * be followed by a highlight without re-selecting) used to wrap a brand-new
 * `{kind:color|…}` *inside* that existing token. Detects that case — the text
 * right before `start` ends an open token and the text right after `end` is
 * its closing brace — and folds the new kind/colour into the same token
 * instead of nesting a second one. Returns null when the selection isn't
 * sitting inside an existing token, so the caller falls back to a plain wrap.
 */
export function mergeColorWrap(
  value: string,
  start: number,
  end: number,
  kind: "c" | "h",
  color: string,
): { next: string; selStart: number; selEnd: number } | null {
  const openAt = new RegExp(`\\{((?:${PAIR_SRC})+)$`).exec(value.slice(0, start));
  if (!openAt || value[end] !== "}") return null;

  const pairs = new Map<string, string>();
  for (const p of openAt[1].matchAll(PAIR)) pairs.set(p[1], p[2]);
  pairs.set(kind, color);
  const newPrefix = Array.from(pairs, ([k, c]) => `${k}:${c}|`).join("");

  const openStart = start - openAt[0].length;
  const selected = value.slice(start, end);
  const next = value.slice(0, openStart) + "{" + newPrefix + selected + "}" + value.slice(end + 1);
  const selStart = openStart + 1 + newPrefix.length;
  return { next, selStart, selEnd: selStart + selected.length };
}

/**
 * Split text into coloured and uncoloured runs.
 *
 * Only `#rgb` / `#rrggbb` are accepted — the regex itself is the allow-list,
 * so `{c:url(javascript:…)|x}` never matches and survives as plain text
 * rather than reaching a style attribute.
 */
export function parseInline(text: string): Segment[] {
  if (!text) return [];
  const normalised = unnestTokens(text);
  const out: Segment[] = [];
  let last = 0;
  for (const m of normalised.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: normalised.slice(last, at) });
    const [, prefix, inner] = m;
    if (inner) {
      const seg: Segment = { text: inner };
      for (const p of prefix.matchAll(PAIR)) {
        if (p[1] === "c") seg.color = p[2];
        else seg.background = p[2];
      }
      out.push(seg);
    }
    last = at + m[0].length;
  }
  if (last < normalised.length) out.push({ text: normalised.slice(last) });
  return out.length ? out : [{ text: normalised }];
}

/** Markup-free length, for word counts that shouldn't see the tokens. */
export function stripInline(text: string): string {
  return unnestTokens(text).replace(INLINE, "$2");
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Sentence enders, Arabic and Latin. `،` is a comma and deliberately absent. */
const SENTENCE = /[^.!?؟…]+[.!?؟…]+["'”»]?\s*|[^.!?؟…]+$/g;

/**
 * Break a paragraph that runs too long into shorter ones.
 *
 * Splits only at sentence boundaries: a paragraph cut mid-sentence reads as a
 * rendering fault, which is worse than the long block being fixed. A
 * paragraph that is one enormous sentence therefore comes back unchanged —
 * there is nowhere safe to cut it, and that is the honest outcome.
 */
export function splitLongParagraph(text: string, maxWords = 90, targetWords = 60): string[] {
  const clean = text.trim();
  if (!clean || words(stripInline(clean)) <= maxWords) return [clean];

  const sentences = clean.match(SENTENCE)?.map((s) => s.trim()).filter(Boolean) ?? [];
  if (sentences.length < 2) return [clean];

  const chunks: string[] = [];
  let buffer: string[] = [];
  let count = 0;
  for (const sentence of sentences) {
    buffer.push(sentence);
    count += words(stripInline(sentence));
    if (count >= targetWords) {
      chunks.push(buffer.join(" "));
      buffer = [];
      count = 0;
    }
  }
  // A short tail joins the previous chunk rather than becoming a stub line.
  if (buffer.length) {
    if (chunks.length && count < 20) chunks[chunks.length - 1] += " " + buffer.join(" ");
    else chunks.push(buffer.join(" "));
  }
  return chunks;
}

/**
 * Group blocks into reader-sized pages.
 *
 * Returns a single page for anything under `minWordsToPaginate` — most news
 * stories are one page and should stay that way; pagination is for the long
 * «ملف خاص» pieces the client was describing.
 *
 * Pages prefer to start on a heading: breaking immediately before one puts
 * the section title at the top of the next page, which is where a reader
 * expects it, instead of stranding it at the bottom of the previous.
 */
export function paginateBlocks<T extends { type: string; text?: string }>(
  blocks: T[],
  { minWordsToPaginate = 700, wordsPerPage = 450 } = {},
): T[][] {
  const total = blocks.reduce((n, b) => n + (b.text ? words(stripInline(b.text)) : 0), 0);
  if (total < minWordsToPaginate) return [blocks];

  const pages: T[][] = [];
  let page: T[] = [];
  let count = 0;
  blocks.forEach((block, i) => {
    const next = blocks[i + 1];
    page.push(block);
    count += block.text ? words(stripInline(block.text)) : 0;
    const breakHereIsClean = next?.type === "heading" || !next;
    if (count >= wordsPerPage && breakHereIsClean && next) {
      pages.push(page);
      page = [];
      count = 0;
    }
  });
  if (page.length) pages.push(page);
  // A trailing page with almost nothing on it is worse than a slightly long
  // one — fold it back.
  if (pages.length > 1 && pages[pages.length - 1].length <= 1) {
    const tail = pages.pop()!;
    pages[pages.length - 1].push(...tail);
  }
  return pages;
}
