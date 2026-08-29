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

/** A run of body text, optionally coloured and/or bold/italic/underlined. */
export type Segment = {
  text: string;
  color?: string;
  background?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** «فقرة» — the client's own word for a line set larger and bolder than
   *  the body around it, picked out inline rather than lifted into its own
   *  heading block. Renders bold even without `bold` also being set. */
  large?: boolean;
  /**
   * «عنوان فرعي» applied to a selection — a subheading picked out inline,
   * in the accent colour, rather than lifting the selection into its own
   * heading block and splitting the paragraph around it. The block-split
   * version of this tool used to strip any colour/bold the selection
   * already had and rearrange the surrounding text into up to three new
   * blocks — exactly the "text collapses and loses formatting" the client
   * reported. Same mechanics as `large`: a same-run style flag, nothing
   * structural.
   */
  subheading?: boolean;
  /**
   * An image embedded mid-paragraph (MediaAsset.image path) — «بدي اقدر
   * اضيف صورة بين الكلام». An image segment's `text` is always exactly
   * PLACEHOLDER: one real character, so it occupies the same one visible
   * slot everywhere offsets are measured (Range.toString() in the editor,
   * clearRangeInSegments here) as an atomic, unstylable unit — there is no
   * "inside" an inline image the way there is inside a styled run.
   */
  image?: string;
};

/** Unicode's own "there is an embedded object here" character — what an
 *  image segment's `text` holds. Rendered as an actual `<img>` (public page)
 *  or a small non-editable chip (the dashboard's contentEditable box); see
 *  lib/richTextDom.ts and ArticleBlocks.tsx's Rich component. */
export const PLACEHOLDER = "\uFFFC";

/**
 * One prefix segment inside a token: either a coloured pair (`c:#hex|` /
 * `h:#hex|`) or a bare style flag (`b|` / `i|` / `u|` / `L|` / `H|` —
 * bold/italic/underline/large/subheading, which carry no value of their own).
 */
const PAIR_SRC = "(?:[ch]:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\||[biuLH]\\|)";
const PAIR = new RegExp(`([ch]):(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}))\\||([biuLH])\\|`, "g");

/**
 * `{c:#RRGGBB|…}` = text colour, `{h:#RRGGBB|…}` = highlight, `{b|…}` /
 * `{i|…}` / `{u|…}` / `{L|…}` / `{H|…}` = bold / italic / underline / large /
 * subheading, and any of these can stack on the same run as `{c:#RRGGBB|b|…}`
 * — one token, one or more prefix segments, then the text. Stacking is what
 * lets an editor colour a word and then bold it without re-selecting (see
 * TextColorToolbar's apply()); it has to be one token rather than a nested
 * `{c:…|{h:…|…}}` pair because the inner group below (`[^{}]*`) —
 * deliberately, so stray braces in body text can't be mistaken for markup —
 * cannot match across a nested brace, which used to leak the outer wrapper
 * as literal text.
 */
const INLINE = new RegExp(`\\{((?:${PAIR_SRC})+)([^{}]*)\\}`, "g");

/**
 * `{img:library/x.jpg}` — an embedded image, self-contained rather than
 * wrapping text like every other token here. Kept as its own regex (not
 * folded into PAIR_SRC) because it carries no text payload for INLINE's
 * `([^{}]*)` group to capture: TOKEN below matches either shape.
 */
const IMAGE_SRC = "img:([^{}]*)";

/** Either an image token or a styled-text token — the one pass parseInline,
 *  stripInline and rawOffsetFromVisible all scan with. Group 1 is the image
 *  path; groups 2/3 are the styled-token prefix/inner text, mirroring
 *  INLINE's own groups 1/2. */
const TOKEN = new RegExp(`\\{(?:${IMAGE_SRC}|((?:${PAIR_SRC})+)([^{}]*))\\}`, "g");

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

/**
 * Opening prefix for a token. `color` is omitted for the flag kinds (bold/
 * italic/underline), which carry no value of their own.
 */
export const COLOR_OPEN = (kind: "c" | "h" | "b" | "i" | "u" | "L" | "H", color?: string) =>
  `{${kind}${color ? `:${color}` : ""}|`;

/**
 * Re-applying a style to a selection that a previous apply() left selected
 * (TextColorToolbar re-selects the just-wrapped text so a colour can be
 * followed by bold without re-selecting) used to wrap a brand-new
 * `{kind:…|…}` *inside* that existing token. Detects that case — the text
 * right before `start` ends an open token and the text right after `end` is
 * its closing brace — and folds the new kind (and colour, if it has one)
 * into the same token instead of nesting a second one. Returns null when the
 * selection isn't sitting inside an existing token, so the caller falls back
 * to a plain wrap.
 */
export function mergeColorWrap(
  value: string,
  start: number,
  end: number,
  kind: "c" | "h" | "b" | "i" | "u" | "L" | "H",
  color?: string,
): { next: string; selStart: number; selEnd: number } | null {
  const openAt = new RegExp(`\\{((?:${PAIR_SRC})+)$`).exec(value.slice(0, start));
  if (!openAt || value[end] !== "}") return null;

  const pairs = new Map<string, string | undefined>();
  for (const p of openAt[1].matchAll(PAIR)) {
    if (p[1]) pairs.set(p[1], p[2]);
    else if (p[3]) pairs.set(p[3], undefined);
  }
  pairs.set(kind, color);
  const newPrefix = Array.from(pairs, ([k, c]) => (c ? `${k}:${c}|` : `${k}|`)).join("");

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
  for (const m of normalised.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: normalised.slice(last, at) });
    const [, imagePath, prefix, inner] = m;
    if (imagePath !== undefined) {
      out.push({ text: PLACEHOLDER, image: imagePath });
    } else if (inner) {
      const seg: Segment = { text: inner };
      for (const p of prefix.matchAll(PAIR)) {
        if (p[1] === "c") seg.color = p[2];
        else if (p[1] === "h") seg.background = p[2];
        else if (p[3] === "b") seg.bold = true;
        else if (p[3] === "i") seg.italic = true;
        else if (p[3] === "u") seg.underline = true;
        else if (p[3] === "L") seg.large = true;
        else if (p[3] === "H") seg.subheading = true;
      }
      out.push(seg);
    }
    last = at + m[0].length;
  }
  if (last < normalised.length) out.push({ text: normalised.slice(last) });
  return out.length ? out : [{ text: normalised }];
}

/** Markup-free length, for word counts that shouldn't see the tokens. An
 *  image collapses to PLACEHOLDER's one character, same as everywhere else
 *  an image segment's visible footprint is measured. */
export function stripInline(text: string): string {
  return unnestTokens(text).replace(TOKEN, (_m, imagePath: string | undefined, _prefix: string, inner: string) =>
    imagePath !== undefined ? PLACEHOLDER : inner,
  );
}

/** The inverse of parseInline: segments back to the token grammar. */
export function serializeSegments(segments: Segment[]): string {
  return segments
    .map((s) => {
      if (s.image !== undefined) return `{img:${s.image}}`;
      let prefix = "";
      if (s.color) prefix += `c:${s.color}|`;
      if (s.background) prefix += `h:${s.background}|`;
      if (s.bold) prefix += "b|";
      if (s.italic) prefix += "i|";
      if (s.underline) prefix += "u|";
      if (s.large) prefix += "L|";
      if (s.subheading) prefix += "H|";
      return prefix ? `{${prefix}${s.text}}` : s.text;
    })
    .join("");
}

/**
 * Drop all styling from the portion of `segments` between the two VISIBLE
 * (stripped-text) offsets, keeping whatever sits outside that range styled
 * exactly as it was — including a segment the range only partially covers,
 * which gets split into a still-styled part and a now-plain part.
 *
 * This is deliberately segment-based rather than a raw-string slice: raw
 * offsets from rawOffsetFromVisible land *inside* an existing token's
 * payload on purpose (that's what lets mergeColorWrap fold a new style into
 * it), which is exactly wrong for clearing — slicing there and splicing the
 * same substring back in reproduces the original token unchanged, wrapper
 * and all. Working from the already-parsed segments sidesteps that: there's
 * no wrapper to accidentally preserve, only styled-or-not runs of text.
 *
 * An image segment is never split or stripped, whatever the range does to
 * it — there's no "half an image" or "an image with its colour cleared", so
 * it always passes through unchanged. It still advances `pos` by its one
 * PLACEHOLDER character, so segments after it keep the offsets their real
 * one-character-wide DOM slot actually has.
 */
export function clearRangeInSegments(segments: Segment[], start: number, end: number): Segment[] {
  const out: Segment[] = [];
  let pos = 0;
  for (const seg of segments) {
    const segStart = pos;
    const segEnd = pos + seg.text.length;
    pos = segEnd;
    if (seg.image !== undefined) {
      out.push(seg);
      continue;
    }
    const overlapStart = Math.max(segStart, start);
    const overlapEnd = Math.min(segEnd, end);
    if (overlapStart >= overlapEnd) {
      if (seg.text) out.push(seg);
      continue;
    }
    if (overlapStart > segStart) out.push({ ...seg, text: seg.text.slice(0, overlapStart - segStart) });
    out.push({ text: seg.text.slice(overlapStart - segStart, overlapEnd - segStart) });
    if (overlapEnd < segEnd) out.push({ ...seg, text: seg.text.slice(overlapEnd - segStart) });
  }
  return out;
}

/**
 * Map a position in the STRIPPED text — what RichTextEditor's live,
 * hex-free box actually shows and lets the editor select — back to the
 * equivalent position in the raw token string, i.e. what mergeColorWrap and
 * the plain-wrap fallback expect as `start`/`end`.
 *
 * A visible offset sitting exactly on the boundary of a token resolves to
 * *inside* that token (its first/last raw position) rather than just before
 * the opening `{` — the case a browser selection actually produces when an
 * editor selects a coloured word by, say, double-clicking it. Landing at the
 * closing `}` for an end-offset is deliberate too: it's exactly what
 * mergeColorWrap's `value[end] !== "}"` check needs to recognise the
 * selection as sitting inside an existing token.
 *
 * An image token is the one exception to "landing inside": it's exactly one
 * visible character (PLACEHOLDER) wide with no payload to land inside the
 * way a styled run has, so every offset touching it resolves to just before
 * or just after the whole `{img:…}` span, never partway through it.
 */
export function rawOffsetFromVisible(value: string, visibleOffset: number): number {
  const normalised = unnestTokens(value);
  let visPos = 0;
  let last = 0;
  for (const m of normalised.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    const plainLen = at - last;
    if (visibleOffset < visPos + plainLen) return last + (visibleOffset - visPos);
    visPos += plainLen;
    last = at;

    const [, imagePath, prefix, inner] = m;
    if (imagePath !== undefined) {
      if (visibleOffset <= visPos) return at;
      visPos += 1;
      last = at + m[0].length;
      continue;
    }
    if (visibleOffset <= visPos + inner.length) {
      const innerRawStart = at + 1 + prefix.length; // "{" + prefix, then the payload
      return innerRawStart + (visibleOffset - visPos);
    }
    visPos += inner.length;
    last = at + m[0].length;
  }
  return last + (visibleOffset - visPos);
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
