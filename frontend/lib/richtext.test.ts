import { describe, expect, it } from "vitest";

import { paginateBlocks, parseInline, splitLongParagraph, stripInline } from "./richtext";

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
});

describe("stripInline", () => {
  it("leaves the words and drops the tokens", () => {
    expect(stripInline("قبل {c:#B01F2E|ملوّن} بعد")).toBe("قبل ملوّن بعد");
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
