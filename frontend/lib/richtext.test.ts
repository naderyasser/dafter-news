import { describe, expect, it } from "vitest";

import {
  clearRangeInSegments,
  mergeColorWrap,
  paginateBlocks,
  parseInline,
  PLACEHOLDER,
  rawOffsetFromVisible,
  serializeSegments,
  splitLongParagraph,
  stripInline,
} from "./richtext";

const sentence = (n: number) => `هذه الجملة رقم ${n} وفيها عدد من الكلمات المتوسطة الطول لاختبار التقسيم الصحيح.`;
const para = (count: number) =>
  Array.from({ length: count }, (_, i) => sentence(i + 1)).join(" ");

describe("parseInline", () => {
  it("returns one plain run when there is no markup", () => {
    expect(parseInline("نص عادي")).toEqual([{ text: "نص عادي" }]);
  });

  it("pulls out a coloured run and the text around it", () => {
    expect(parseInline("قبل {c:#B01F2E|ملوّن} بعد")).toEqual([
      { text: "قبل " },
      { text: "ملوّن", color: "#B01F2E" },
      { text: " بعد" },
    ]);
  });

  it("treats {h:…} as a highlight, not a text colour", () => {
    expect(parseInline("{h:#FFF3B0|مظلّل}")).toEqual([{ text: "مظلّل", background: "#FFF3B0" }]);
  });

  it("accepts the three-digit hex form", () => {
    expect(parseInline("{c:#f00|أحمر}")).toEqual([{ text: "أحمر", color: "#f00" }]);
  });

  it("refuses anything that is not a hex colour", () => {
    // The regex is the allow-list: this is what stops an editor-supplied value
    // reaching a style attribute. It must survive as literal text.
    const hostile = "{c:url(javascript:alert(1))|x}";
    expect(parseInline(hostile)).toEqual([{ text: hostile }]);
  });

  it("never emits markup as if it were a colour", () => {
    const segments = parseInline("{c:#B01F2E|<script>alert(1)</script>}");
    expect(segments).toEqual([{ text: "<script>alert(1)</script>", color: "#B01F2E" }]);
    // The payload is a *string* in a React child, so it renders as text.
    expect(typeof segments[0].text).toBe("string");
  });

  it("handles several runs in one paragraph", () => {
    expect(parseInline("{c:#111111|أ}و{h:#FFF3B0|ب}")).toHaveLength(3);
  });

  it("survives an unclosed token", () => {
    expect(parseInline("{c:#B01F2E|بلا إغلاق")).toEqual([{ text: "{c:#B01F2E|بلا إغلاق" }]);
  });

  it("reads a colour and a highlight stacked on the same run", () => {
    expect(parseInline("{c:#0E4B7B|h:#FFF3B0|كلمة}")).toEqual([
      { text: "كلمة", color: "#0E4B7B", background: "#FFF3B0" },
    ]);
  });

  it("regression: recovers a nested token instead of leaking the wrapper as text", () => {
    // The exact shape a stale textarea selection used to produce: apply a
    // colour, then — without re-selecting — a highlight on the same word.
    const nested = "hello {c:#0E4B7B|{h:#FFF3B0|world}} foo";
    expect(parseInline(nested)).toEqual([
      { text: "hello " },
      { text: "world", color: "#0E4B7B", background: "#FFF3B0" },
      { text: " foo" },
    ]);
  });

  it("reads a bold flag, which carries no colour value of its own", () => {
    expect(parseInline("{b|غامق}")).toEqual([{ text: "غامق", bold: true }]);
  });

  it("reads italic and underline the same way", () => {
    expect(parseInline("{i|مائل}")).toEqual([{ text: "مائل", italic: true }]);
    expect(parseInline("{u|تحته خط}")).toEqual([{ text: "تحته خط", underline: true }]);
  });

  it("stacks bold with a text colour on the same run", () => {
    expect(parseInline("{c:#B01F2E|b|عاجل}")).toEqual([{ text: "عاجل", color: "#B01F2E", bold: true }]);
  });

  it("reads a large flag, which carries no colour value of its own", () => {
    // «فقرة» — the client's own word for a line set bigger and bolder than
    // the body around it, marked inline rather than lifted into a new block.
    expect(parseInline("{L|فقرة مميزة}")).toEqual([{ text: "فقرة مميزة", large: true }]);
  });

  it("pulls out an image embedded mid-paragraph as its own atomic segment", () => {
    // «بدي اقدر اضيف صورة بين الكلام» — an inline image, not text to style.
    expect(parseInline("اكد الوزير {img:library/x.jpg} ان سيتم رفع الرواتب")).toEqual([
      { text: "اكد الوزير " },
      { text: PLACEHOLDER, image: "library/x.jpg" },
      { text: " ان سيتم رفع الرواتب" },
    ]);
  });
});

describe("mergeColorWrap", () => {
  it("returns null when the selection isn't inside an existing token", () => {
    expect(mergeColorWrap("hello world", 0, 5, "c", "#0E4B7B")).toBeNull();
  });

  it("folds a second colour into the token a previous apply() left selected, instead of nesting", () => {
    // "word" is already wrapped, and start/end sit exactly on its inner text —
    // the reselect apply() leaves behind after wrapping it once.
    const value = "hi {c:#0E4B7B|word} bye";
    const start = value.indexOf("word");
    const end = start + "word".length;

    const merged = mergeColorWrap(value, start, end, "h", "#FFF3B0");
    expect(merged).not.toBeNull();
    expect(merged!.next).toBe("hi {c:#0E4B7B|h:#FFF3B0|word} bye");
    expect(merged!.next.slice(merged!.selStart, merged!.selEnd)).toBe("word");
    // And the merged token parses as both a colour and a highlight, with no
    // leaked braces anywhere in the output.
    expect(parseInline(merged!.next)).toEqual([
      { text: "hi " },
      { text: "word", color: "#0E4B7B", background: "#FFF3B0" },
      { text: " bye" },
    ]);
  });

  it("replaces the colour rather than stacking when the same kind is re-applied", () => {
    const value = "hi {c:#0E4B7B|word} bye";
    const start = value.indexOf("word");
    const end = start + "word".length;

    const merged = mergeColorWrap(value, start, end, "c", "#B01F2E");
    expect(merged!.next).toBe("hi {c:#B01F2E|word} bye");
  });

  it("folds a bold flag (no colour) into an existing coloured token", () => {
    const value = "hi {c:#0E4B7B|word} bye";
    const start = value.indexOf("word");
    const end = start + "word".length;

    const merged = mergeColorWrap(value, start, end, "b");
    expect(merged!.next).toBe("hi {c:#0E4B7B|b|word} bye");
    expect(parseInline(merged!.next)).toEqual([
      { text: "hi " },
      { text: "word", color: "#0E4B7B", bold: true },
      { text: " bye" },
    ]);
  });
});

describe("rawOffsetFromVisible", () => {
  // "قبل " (4) + "أحمر" (4, coloured) + " بعد" (4) — stripped: "قبل أحمر بعد"
  const value = "قبل {c:#B01F2E|أحمر} بعد";
  const raw = (visible: number) => rawOffsetFromVisible(value, visible);

  it("is the identity mapping when there's no markup at all", () => {
    expect(rawOffsetFromVisible("hello world", 6)).toBe(6);
  });

  it("maps a position before any token straight through", () => {
    expect(raw(2)).toBe(2); // inside "قب"
  });

  it("lands inside the token's payload for a position within the coloured word", () => {
    // visible index 6 = 2 characters into "أحمر" ("قبل " + "أح" = 6)
    expect(raw(6)).toBe(value.indexOf("أحمر") + 2);
  });

  it("resolves a boundary right before a coloured word to the start of its payload, not the opening brace", () => {
    // visible index 4 = right where "أحمر" begins
    expect(raw(4)).toBe(value.indexOf("أحمر"));
  });

  it("resolves the boundary right after a coloured word to its closing brace — what mergeColorWrap's value[end] check needs", () => {
    // visible index 8 = right after "أحمر" ends
    const end = raw(8);
    expect(value[end]).toBe("}");
  });

  it("maps a position after the token straight through, offset by the token's raw overhead", () => {
    // visible index 10 = 2 characters into " بعد"
    expect(raw(10)).toBe(value.indexOf("}") + 1 + 2);
  });

  it("round-trips through mergeColorWrap for a selection landing exactly on the coloured word", () => {
    // Exactly what a double-click-to-select would produce in the live box.
    const start = raw(4);
    const end = raw(8);
    const merged = mergeColorWrap(value, start, end, "b");
    expect(merged).not.toBeNull();
    expect(merged!.next).toBe("قبل {c:#B01F2E|b|أحمر} بعد");
  });

  it("resolves an offset right before an image to just outside its opening brace, never inside it", () => {
    // "قبل " (4, stripped) then one PLACEHOLDER character for the image.
    const withImage = "قبل {img:library/x.jpg} بعد";
    expect(rawOffsetFromVisible(withImage, 4)).toBe(withImage.indexOf("{img:"));
  });

  it("resolves an offset right after an image to just past its closing brace", () => {
    const withImage = "قبل {img:library/x.jpg} بعد";
    const after = withImage.indexOf("{img:library/x.jpg}") + "{img:library/x.jpg}".length;
    expect(rawOffsetFromVisible(withImage, 5)).toBe(after);
  });
});

describe("stripInline", () => {
  it("leaves the words and drops the tokens", () => {
    expect(stripInline("قبل {c:#B01F2E|ملوّن} بعد")).toBe("قبل ملوّن بعد");
  });

  it("drops a stacked colour+highlight token cleanly", () => {
    expect(stripInline("قبل {c:#0E4B7B|h:#FFF3B0|ملوّن} بعد")).toBe("قبل ملوّن بعد");
  });

  it("collapses an embedded image to its one-character placeholder", () => {
    expect(stripInline("قبل {img:library/x.jpg} بعد")).toBe(`قبل ${PLACEHOLDER} بعد`);
  });
});

describe("serializeSegments", () => {
  it("round-trips through parseInline", () => {
    const value = "قبل {c:#B01F2E|b|أحمر} بعد";
    expect(serializeSegments(parseInline(value))).toBe(value);
  });

  it("emits plain text with no wrapper at all", () => {
    expect(serializeSegments([{ text: "نص عادي" }])).toBe("نص عادي");
  });

  it("orders a segment's stacked flags the same way COLOR_OPEN/mergeColorWrap do — c, h, b, i, u", () => {
    expect(serializeSegments([{ text: "س", color: "#111111", underline: true, bold: true }])).toBe("{c:#111111|b|u|س}");
  });

  it("round-trips the large flag through parseInline", () => {
    const value = "قبل {L|فقرة} بعد";
    expect(serializeSegments(parseInline(value))).toBe(value);
  });

  it("round-trips an embedded image through parseInline", () => {
    const value = "قبل {img:library/x.jpg} بعد";
    expect(serializeSegments(parseInline(value))).toBe(value);
  });
});

describe("clearRangeInSegments", () => {
  it("strips styling only from the part of a segment the range covers, splitting it in two", () => {
    // "قبل أحمر بعد" — clear just "أحمر" (visible offsets 4..8).
    const segments = parseInline("قبل {c:#B01F2E|أحمر} بعد");
    const cleared = clearRangeInSegments(segments, 4, 8);
    expect(serializeSegments(cleared)).toBe("قبل أحمر بعد");
  });

  it("leaves segments entirely outside the range untouched", () => {
    const segments = parseInline("{c:#B01F2E|أحمر} {h:#FFF3B0|مظلّل}");
    // Clear only the first word (0..4); the highlighted one must survive.
    const cleared = clearRangeInSegments(segments, 0, 4);
    expect(serializeSegments(cleared)).toBe("أحمر {h:#FFF3B0|مظلّل}");
  });

  it("splits a segment the range only partially overlaps, keeping styling on the untouched part", () => {
    // "أحمر جداً" all coloured — clear only "جداً" (visible offsets 5..9).
    const segments = parseInline("{c:#B01F2E|أحمر جداً}");
    const cleared = clearRangeInSegments(segments, 5, 9);
    expect(cleared).toEqual([
      { text: "أحمر ", color: "#B01F2E" },
      { text: "جداً" },
    ]);
  });

  it("clears everything when the range spans the whole text", () => {
    const segments = parseInline("{c:#B01F2E|كل النص هنا}");
    expect(serializeSegments(clearRangeInSegments(segments, 0, "كل النص هنا".length))).toBe("كل النص هنا");
  });

  it("passes an embedded image through untouched even when the clear range spans it", () => {
    // There's no "half an image" or "an image with its colour cleared" —
    // clearing formatting across a selection that happens to include one
    // must never drop the image itself.
    const value = "قبل {img:library/x.jpg} بعد";
    const segments = parseInline(value);
    const cleared = clearRangeInSegments(segments, 0, stripInline(value).length);
    expect(serializeSegments(cleared)).toBe(value);
  });
});

describe("splitLongParagraph", () => {
  it("leaves a short paragraph alone", () => {
    const short = sentence(1);
    expect(splitLongParagraph(short)).toEqual([short]);
  });

  it("breaks a wall of text into several paragraphs", () => {
    const chunks = splitLongParagraph(para(12));

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(para(12).replace(/\s+/g, " "));
  });

  it("only ever cuts at a sentence end", () => {
    for (const chunk of splitLongParagraph(para(12))) {
      expect(chunk.trim()).toMatch(/[.!?؟…]$/);
    }
  });

  it("returns one enormous sentence unchanged rather than cutting mid-thought", () => {
    // regression: there is nowhere safe to break, and a paragraph cut
    // mid-sentence reads as a rendering fault.
    const runOn = "كلمة ".repeat(200).trim();
    expect(splitLongParagraph(runOn)).toEqual([runOn]);
  });

  it("does not leave a one-line stub at the end", () => {
    const chunks = splitLongParagraph(para(11));
    const last = chunks[chunks.length - 1].split(/\s+/).length;
    expect(last).toBeGreaterThan(5);
  });

  it("counts words without the colour markup", () => {
    // A paragraph made long only by its tokens is not actually long.
    const withTokens = Array.from({ length: 8 }, (_, i) => `{c:#B01F2E|كلمة${i}}`).join(" ");
    expect(splitLongParagraph(withTokens)).toEqual([withTokens]);
  });
});

describe("paginateBlocks", () => {
  const p = (text: string) => ({ type: "paragraph", text });
  const h = (text: string) => ({ type: "heading", text });

  it("keeps a normal news story on one page", () => {
    const blocks = [p(para(2)), p(para(2))];
    expect(paginateBlocks(blocks)).toHaveLength(1);
  });

  it("splits a long feature across pages", () => {
    const blocks = [p(para(20)), h("فصل"), p(para(20)), h("فصل"), p(para(20))];
    expect(paginateBlocks(blocks).length).toBeGreaterThan(1);
  });

  it("loses no blocks when it paginates", () => {
    const blocks = [p(para(20)), h("أ"), p(para(20)), h("ب"), p(para(20))];
    expect(paginateBlocks(blocks).flat()).toHaveLength(blocks.length);
  });

  it("starts a new page on a heading, never mid-section", () => {
    const blocks = [p(para(20)), h("أ"), p(para(20)), h("ب"), p(para(20))];
    for (const page of paginateBlocks(blocks).slice(1)) {
      expect(page[0].type).toBe("heading");
    }
  });

  it("folds a near-empty trailing page back into the previous one", () => {
    const pages = paginateBlocks([p(para(20)), h("أ"), p(para(20)), h("ب")]);
    expect(pages[pages.length - 1].length).toBeGreaterThan(1);
  });
});
