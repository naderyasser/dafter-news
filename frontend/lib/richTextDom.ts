/**
 * DOM side of RichTextEditor's contentEditable box: the token string
 * (lib/richtext.ts) in, real styled `<span>`s out, and back.
 *
 * Kept separate from lib/richtext.ts on purpose — everything there is pure
 * string logic with no DOM dependency, which is what lets the public site's
 * renderer and this editor share it. Only the editor needs an actual DOM to
 * paint into and read a live selection out of.
 */
import { parseInline, PLACEHOLDER } from "./richtext";

/**
 * Paint `text` into `root` as plain Text nodes and styled `<span>`s — one
 * level, no nesting — clearing whatever was there first.
 *
 * The colour is stored twice: as the visible `style.color`/
 * `backgroundColor` AND as a `data-color`/`data-bg` attribute. Reading it
 * back off `style` alone would mean parsing the browser's normalised
 * `rgb(r, g, b)` serialisation, which is lossy for the 3-digit hex form our
 * token grammar also accepts (`#f00` and `#ff0000` both round-trip to the
 * same rgb()); the data attribute keeps the exact string that was set.
 */
export function renderTokensInto(root: HTMLElement, text: string): void {
  while (root.firstChild) root.removeChild(root.firstChild);
  for (const seg of parseInline(text)) {
    if (seg.image !== undefined) {
      // A non-editable chip, not the actual photo — showing the real image
      // inline here risks a full-size photo blowing out this small box
      // mid-keystroke, and an editor already saw it once when picking it
      // from the library. The public page (ArticleBlocks' Rich component)
      // is where the real `<img>` renders. contentEditable="false" makes
      // the browser treat it as one atomic unit for arrow-key/backspace
      // purposes; the PLACEHOLDER text node inside it is what keeps
      // Range.toString()-based offsets one character wide across it.
      const span = document.createElement("span");
      span.contentEditable = "false";
      span.dataset.image = seg.image;
      span.style.display = "inline-flex";
      span.style.alignItems = "center";
      span.style.gap = "0.3em";
      span.style.margin = "0 0.15em";
      span.style.padding = "0.05em 0.5em";
      span.style.borderRadius = "4px";
      span.style.border = "1px dashed currentColor";
      span.style.opacity = "0.7";
      span.style.fontSize = "0.85em";
      span.style.userSelect = "none";
      span.append("🖼 صورة");
      span.appendChild(document.createTextNode(PLACEHOLDER));
      root.appendChild(span);
      continue;
    }
    if (seg.color || seg.background || seg.bold || seg.italic || seg.underline || seg.large) {
      const span = document.createElement("span");
      if (seg.color) {
        span.style.color = seg.color;
        span.dataset.color = seg.color;
      }
      if (seg.background) {
        span.style.backgroundColor = seg.background;
        span.dataset.bg = seg.background;
        span.style.padding = "0.05em 0.25em";
        span.style.borderRadius = "3px";
      }
      if (seg.bold) span.style.fontWeight = "700";
      if (seg.italic) span.style.fontStyle = "italic";
      if (seg.underline) span.style.textDecorationLine = "underline";
      if (seg.large) {
        // Reads bold+bigger visually the same as `bold` sets fontWeight —
        // a data attribute (like colour's) is what makes this one
        // distinguishable on the way back out in styleOf(), rather than
        // large-without-bold being indistinguishable from plain bold once
        // painted.
        span.dataset.large = "1";
        span.style.fontSize = "1.2em";
        span.style.fontWeight = "700";
      }
      span.appendChild(document.createTextNode(seg.text));
      root.appendChild(span);
    } else if (seg.text) {
      root.appendChild(document.createTextNode(seg.text));
    }
  }
}

type ActiveStyle = { color?: string; background?: string; bold?: boolean; italic?: boolean; underline?: boolean; large?: boolean };

function styleOf(el: HTMLElement): ActiveStyle {
  return {
    color: el.dataset.color,
    background: el.dataset.bg,
    bold: el.style.fontWeight === "700" || el.style.fontWeight === "bold" || el.tagName === "B" || el.tagName === "STRONG",
    italic: el.style.fontStyle === "italic" || el.tagName === "I" || el.tagName === "EM",
    underline: el.style.textDecorationLine === "underline" || el.tagName === "U",
    large: el.dataset.large === "1",
  };
}

function walk(node: Node, active: ActiveStyle): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (!text) return "";
    let prefix = "";
    if (active.color) prefix += `c:${active.color}|`;
    if (active.background) prefix += `h:${active.background}|`;
    if (active.bold) prefix += "b|";
    if (active.italic) prefix += "i|";
    if (active.underline) prefix += "u|";
    if (active.large) prefix += "L|";
    return prefix ? `{${prefix}${text}}` : text;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  if (el.tagName === "BR") return "";
  // The image chip's own children (the label text, the <img> if one is ever
  // added, the PLACEHOLDER text node) are internal to how it's painted —
  // never walked as if they were ordinary editable content.
  if (el.dataset.image !== undefined) return `{img:${el.dataset.image}}`;
  const own = styleOf(el);
  const merged: ActiveStyle = {
    color: own.color ?? active.color,
    background: own.background ?? active.background,
    bold: own.bold || active.bold,
    italic: own.italic || active.italic,
    underline: own.underline || active.underline,
    large: own.large || active.large,
  };
  let out = "";
  for (const child of Array.from(el.childNodes)) out += walk(child, merged);
  return out;
}

/**
 * The reverse of renderTokensInto: read the live, editor-mutated DOM back
 * into the same token grammar. Walked recursively (rather than assuming the
 * exact single-level shape renderTokensInto produces) because typing right
 * at the edge of a styled span can leave the browser's own DOM slightly
 * different from what we last painted — this stays correct either way.
 */
export function domToTokens(root: HTMLElement): string {
  let out = "";
  for (const child of Array.from(root.childNodes)) out += walk(child, {});
  return out;
}

/**
 * The current selection inside `root`, as plain-text offsets — exactly what
 * rawOffsetFromVisible expects. Null when there's no selection in this
 * field at all (focus is elsewhere).
 *
 * `Range.toString()` — a range from the start of `root` to the selection
 * boundary — is what does the node/offset-to-plain-text-length conversion;
 * it already accounts for text split across several nodes, so there's no
 * manual tree-walking here.
 */
export function getVisibleSelection(root: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection?.();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (range.commonAncestorContainer !== root && !root.contains(range.commonAncestorContainer)) return null;

  const offsetOf = (node: Node, offset: number) => {
    const measuring = document.createRange();
    measuring.selectNodeContents(root);
    measuring.setEnd(node, offset);
    return measuring.toString().length;
  };
  const a = offsetOf(range.startContainer, range.startOffset);
  const b = offsetOf(range.endContainer, range.endOffset);
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

/** Find the (node, offset) pair `target` plain-text characters into `root`. */
function nodeAtOffset(root: Node, target: number): { node: Node; offset: number } {
  if (root.nodeType === Node.TEXT_NODE) {
    return { node: root, offset: Math.min(target, (root.textContent ?? "").length) };
  }
  let remaining = target;
  for (const child of Array.from(root.childNodes)) {
    const len = (child.textContent ?? "").length;
    if (remaining <= len) return nodeAtOffset(child, remaining);
    remaining -= len;
  }
  const last = root.lastChild;
  return last ? nodeAtOffset(last, (last.textContent ?? "").length) : { node: root, offset: 0 };
}

/** Place the browser's selection at the given plain-text offsets inside `root`. */
export function setVisibleSelection(root: HTMLElement, start: number, end: number): void {
  const sel = window.getSelection?.();
  if (!sel) return;
  const a = nodeAtOffset(root, start);
  const b = nodeAtOffset(root, end);
  const range = document.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  sel.removeAllRanges();
  sel.addRange(range);
}
