import { describe, expect, it } from "vitest";

import { domToTokens, getVisibleSelection, renderTokensInto, setVisibleSelection } from "./richTextDom";

function box(html?: string) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

describe("renderTokensInto / domToTokens round-trip", () => {
  it("paints plain text as a single text node and reads it back unchanged", () => {
    const el = box();
    renderTokensInto(el, "نص عادي بلا تنسيق");
    expect(el.childNodes).toHaveLength(1);
    expect(el.firstChild?.nodeType).toBe(Node.TEXT_NODE);
    expect(domToTokens(el)).toBe("نص عادي بلا تنسيق");
  });

  it("carries a soft line break through as a plain character, not a <br>", () => {
    // RichTextEditor's Enter handler inserts this same "\n" text character
    // (see insertLineBreak) instead of a browser <br> — round-tripping it as
    // ordinary text is what keeps Range.toString()-based offsets accurate
    // across it, with no special case anywhere in this file.
    const el = box();
    renderTokensInto(el, "سطر أول\nسطر ثانٍ");
    expect(el.querySelector("br")).toBeNull();
    expect(domToTokens(el)).toBe("سطر أول\nسطر ثانٍ");
  });

  it("paints an embedded image as a non-editable chip, not the raw token or the real photo", () => {
    const el = box();
    renderTokensInto(el, "قبل {img:library/x.jpg} بعد");

    const chip = el.querySelector("[data-image]") as HTMLElement;
    expect(chip).toBeTruthy();
    expect(chip.dataset.image).toBe("library/x.jpg");
    expect(chip.contentEditable).toBe("false");
    expect(el.textContent).not.toContain("{img:");

    expect(domToTokens(el)).toBe("قبل {img:library/x.jpg} بعد");
  });

  it("paints a coloured run as a styled span, not visible markup", () => {
    const el = box();
    renderTokensInto(el, "قبل {c:#B01F2E|أحمر} بعد");

    const span = el.querySelector("span")!;
    expect(span).toBeTruthy();
    expect(span.textContent).toBe("أحمر");
    expect(span.style.color).toBe("rgb(176, 31, 46)");
    // The exact hex survives in a data attribute — reading it back off the
    // browser's normalised rgb() would be lossy for the 3-digit form.
    expect(span.dataset.color).toBe("#B01F2E");
    expect(el.textContent).not.toContain("{c:#");

    expect(domToTokens(el)).toBe("قبل {c:#B01F2E|أحمر} بعد");
  });

  it("round-trips bold, italic and underline together with a colour", () => {
    const el = box();
    renderTokensInto(el, "{c:#B01F2E|b|i|u|كل شيء}");

    const span = el.querySelector("span")!;
    expect(span.style.fontWeight).toBe("700");
    expect(span.style.fontStyle).toBe("italic");
    expect(span.style.textDecorationLine).toBe("underline");

    expect(domToTokens(el)).toBe("{c:#B01F2E|b|i|u|كل شيء}");
  });

  it("round-trips the large flag via its own data attribute, not just the bold-looking fontWeight it shares", () => {
    const el = box();
    renderTokensInto(el, "{L|فقرة مميزة}");

    const span = el.querySelector("span")!;
    expect(span.dataset.large).toBe("1");
    expect(span.style.fontSize).toBe("1.2em");

    // Large also sets fontWeight to look bold, which styleOf() reads back as
    // an actual bold flag too — harmless (both render identically), just not
    // byte-identical to the input token.
    expect(domToTokens(el)).toBe("{b|L|فقرة مميزة}");
  });

  it("merges an ancestor's style into a nested run — the shape typing at a span's edge can leave behind", () => {
    const el = box();
    const outer = document.createElement("span");
    outer.style.color = "#B01F2E";
    outer.dataset.color = "#B01F2E";
    const inner = document.createElement("span");
    inner.style.fontWeight = "700";
    inner.appendChild(document.createTextNode("نص"));
    outer.appendChild(inner);
    el.appendChild(outer);

    expect(domToTokens(el)).toBe("{c:#B01F2E|b|نص}");
  });

  it("drops a bare <br> rather than emitting a stray character", () => {
    const el = box();
    el.appendChild(document.createTextNode("سطر"));
    el.appendChild(document.createElement("br"));
    expect(domToTokens(el)).toBe("سطر");
  });

  it("clears previous content before painting new content", () => {
    const el = box();
    renderTokensInto(el, "الأول");
    renderTokensInto(el, "الثاني");
    expect(el.textContent).toBe("الثاني");
  });
});

describe("getVisibleSelection / setVisibleSelection", () => {
  it("reads a plain-text selection as plain offsets", () => {
    const el = box();
    renderTokensInto(el, "أسعار الفائدة ترتفع");
    const text = el.firstChild!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 13); // "أسعار الفائدة"
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    expect(getVisibleSelection(el)).toEqual({ start: 0, end: 13 });
  });

  it("reads a selection that spans into a styled span as one continuous offset range", () => {
    const el = box();
    renderTokensInto(el, "قبل {c:#B01F2E|أحمر} بعد");
    // "قبل أحمر بعد" — select from the very start through partway into "بعد".
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(el.childNodes[0], 0);
    range.setEnd(el.childNodes[2], 1); // one character into " بعد"
    sel.removeAllRanges();
    sel.addRange(range);

    const got = getVisibleSelection(el);
    expect(got).toEqual({ start: 0, end: "قبل أحمر ".length });
  });

  it("places the selection at the given plain-text offsets, round-tripping through getVisibleSelection", () => {
    const el = box();
    renderTokensInto(el, "قبل {c:#B01F2E|أحمر} بعد");
    el.focus();

    setVisibleSelection(el, 4, 8); // exactly "أحمر"
    expect(window.getSelection()!.toString()).toBe("أحمر");
    expect(getVisibleSelection(el)).toEqual({ start: 4, end: 8 });
  });

  it("returns null when nothing is selected inside the field", () => {
    const el = box();
    renderTokensInto(el, "نص");
    window.getSelection()!.removeAllRanges();
    expect(getVisibleSelection(el)).toBeNull();
  });
});
