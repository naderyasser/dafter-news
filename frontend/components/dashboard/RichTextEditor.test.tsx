import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";

import RichTextEditor from "./RichTextEditor";

/**
 * The point of this field is that an editor never sees `{c:#hex|…}` — the
 * box itself IS the coloured/formatted result, live, with no second preview
 * and no raw-vs-rendered mode to switch between. These tests drive it the
 * way an editor would (select, click a swatch) and check what actually
 * lands on screen and in the value the parent gets back.
 *
 * domToTokens/renderTokensInto/getVisibleSelection are unit-tested on their
 * own in lib/richTextDom.test.ts; this file is about the wiring between
 * them and the box a reader — sorry, an editor — actually looks at.
 */
function Host({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <RichTextEditor value={value} onChange={setValue} placeholder="نص الفقرة" />;
}

const field = () => screen.getByRole("textbox");

/** Selects `text` inside `el` by locating it in the (already-rendered) DOM. */
function selectWord(el: HTMLElement, word: string) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const at = (node.textContent ?? "").indexOf(word);
    if (at !== -1) {
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + word.length);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    node = walker.nextNode();
  }
  throw new Error(`"${word}" not found in field`);
}

describe("RichTextEditor", () => {
  it("starts genuinely empty, not carrying the placeholder as real content", () => {
    render(<Host />);
    expect(field().textContent).toBe("");
  });

  it("shows existing coloured text as an actually-coloured span, never the {c:#hex|…} token", () => {
    render(<Host initial="قبل {c:#B01F2E|أحمر} بعد" />);

    expect(screen.getByText("أحمر")).toHaveStyle({ color: "rgb(176, 31, 46)" });
    expect(field().textContent).not.toContain("{c:#");
    expect(field().textContent).toBe("قبل أحمر بعد");
  });

  it("serialises typed input back to the parent as it happens", () => {
    const onChange = vi.fn();
    render(<RichTextEditor value="" onChange={onChange} placeholder="نص الفقرة" />);

    // jsdom doesn't simulate native contentEditable typing — mutate the DOM
    // the way a keystroke would, then fire the same event the browser does.
    field().textContent = "خبر جديد";
    fireEvent.input(field());

    expect(onChange).toHaveBeenCalledWith("خبر جديد");
  });

  it("selecting a word and picking a colour turns it that colour right there — no separate preview to look at", () => {
    render(<Host initial="أسعار الفائدة ترتفع" />);

    selectWord(field(), "أسعار الفائدة");
    fireEvent.click(screen.getByRole("button", { name: /تلوين النص/ }));
    fireEvent.click(screen.getByLabelText("لون النص: أحمر الهوية"));

    expect(screen.getByText("أسعار الفائدة")).toHaveStyle({ color: "rgb(176, 31, 46)" });
    expect(field().textContent).not.toContain("{c:#");
    expect(field().textContent).toBe("أسعار الفائدة ترتفع");
  });

  it("keeps the same word selected after colouring, so a highlight can follow without re-selecting", () => {
    render(<Host initial="أسعار الفائدة ترتفع" />);

    selectWord(field(), "أسعار الفائدة");
    fireEvent.click(screen.getByRole("button", { name: /تلوين النص/ }));
    fireEvent.click(screen.getByLabelText("لون النص: أحمر الهوية"));
    fireEvent.click(screen.getByLabelText("تظليل: أصفر"));

    const span = screen.getByText("أسعار الفائدة");
    expect(span).toHaveStyle({ color: "rgb(176, 31, 46)", backgroundColor: "rgb(255, 243, 176)" });
  });

  it("applies bold directly, no panel needed, and it reads as bold in the box", () => {
    render(<Host initial="كلمة مهمة" />);

    selectWord(field(), "مهمة");
    fireEvent.click(screen.getByLabelText("نص غامق"));

    expect(screen.getByText("مهمة")).toHaveStyle({ fontWeight: "700" });
  });

  it("marks a selection as a subheading inline, in place — no block splitting, nothing before/after it disturbed", () => {
    render(<Host initial="قبل العنوان الفرعي بعد" />);

    selectWord(field(), "العنوان الفرعي");
    fireEvent.click(screen.getByLabelText("عنوان فرعي"));

    expect(screen.getByText("العنوان الفرعي")).toHaveStyle({ fontWeight: "800" });
    // The one field still holds the whole sentence — nothing was lifted out
    // into a separate block, nothing before/after it was rearranged.
    expect(field().textContent).toBe("قبل العنوان الفرعي بعد");
  });

  it("refuses to format an empty selection, naming what to do instead", () => {
    const alert = vi.fn();
    vi.stubGlobal("alert", alert);
    render(<Host initial="نص بلا تحديد" />);

    fireEvent.click(screen.getByLabelText("نص غامق"));

    expect(alert).toHaveBeenCalledWith("حدّد النص الذي تريد تنسيقه أولاً.");
    vi.unstubAllGlobals();
  });

  it("clears formatting from the selection and the box shows plain text again", () => {
    render(<Host initial="{c:#B01F2E|أحمر} عادي" />);

    selectWord(field(), "أحمر");
    fireEvent.click(screen.getByRole("button", { name: "إزالة التلوين" }));

    expect(field().textContent).toBe("أحمر عادي");
    expect(field().querySelector("span")).toBeNull();
  });

  it("refuses to format a selection that spans an embedded image, rather than nesting a style token around it", () => {
    const alert = vi.fn();
    vi.stubGlobal("alert", alert);
    render(<Host initial="قبل {img:library/x.jpg} بعد" />);
    const el = field();

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) textNodes.push(n as Text);
    const range = document.createRange();
    range.setStart(textNodes[0], 0);
    range.setEnd(textNodes[textNodes.length - 1], textNodes[textNodes.length - 1].length);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.click(screen.getByLabelText("نص غامق"));

    expect(alert).toHaveBeenCalledWith("لا يمكن تنسيق نص يتضمن صورة.");
    vi.unstubAllGlobals();
  });

  it("keeps an embedded image when clearing formatting from the whole field", () => {
    render(<Host initial="{c:#B01F2E|أحمر} قبل {img:library/x.jpg} بعد" />);

    fireEvent.click(screen.getByRole("button", { name: "إزالة التلوين" }));

    expect(field().querySelector("[data-image]")).not.toBeNull();
  });

  it("prevents the browser's own Enter behaviour — a <div>/<br> the serialiser can't read back", () => {
    render(<Host initial="نص" />);
    const event = fireEvent.keyDown(field(), { key: "Enter" });
    expect(event).toBe(false); // fireEvent returns false when preventDefault() was called
  });

  it("inserts a soft line break inside the same block on Enter, rather than doing nothing", () => {
    const onChange = vi.fn();
    render(<RichTextEditor value="قبل بعد" onChange={onChange} placeholder="نص الفقرة" />);
    const el = field();
    const node = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode()!;
    const at = (node.textContent ?? "").indexOf("بعد");
    const range = document.createRange();
    range.setStart(node, at);
    range.collapse(true);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.keyDown(el, { key: "Enter" });

    // A plain "\n" character, not a structural split — «✂ تقسيم» is still
    // the only thing that creates an actual new block.
    expect(onChange).toHaveBeenCalledWith("قبل \nبعد");
  });

  it("blocks the native bold/italic/underline shortcuts — formatting only ever goes through applyFormat", () => {
    render(<Host initial="نص" />);
    const bold = fireEvent.keyDown(field(), { key: "b", ctrlKey: true });
    expect(bold).toBe(false);
  });

  it("keeps a pasted bold run bold — the clipboard's own HTML, not just its plain-text mirror", () => {
    const onChange = vi.fn();
    render(<RichTextEditor value="" onChange={onChange} placeholder="نص الفقرة" />);
    field().focus();

    const clipboardData = { getData: (type: string) => (type === "text/plain" ? "نص ملصق" : "<b>نص ملصق</b>") };
    fireEvent.paste(field(), { clipboardData });

    expect(onChange).toHaveBeenCalledWith("{b|نص ملصق}");
    expect(screen.getByText("نص ملصق")).toHaveStyle({ fontWeight: "700" });
  });

  it("a multi-paragraph HTML paste (one <p> per paragraph) hands each paragraph to onSplitPaste, formatting kept", () => {
    const onChange = vi.fn();
    const onSplitPaste = vi.fn();
    render(<RichTextEditor value="" onChange={onChange} onSplitPaste={onSplitPaste} placeholder="نص الفقرة" />);
    field().focus();

    const clipboardData = {
      getData: (type: string) =>
        type === "text/html" ? "<p>فقرة <b>أولى</b></p><p>فقرة ثانية</p>" : "فقرة أولى\nفقرة ثانية",
    };
    fireEvent.paste(field(), { clipboardData });

    expect(onSplitPaste).toHaveBeenCalledWith("", ["فقرة {b|أولى}", "فقرة ثانية"], "");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("an HTML paste with no onSplitPaste lands in this one field, paragraph breaks kept as soft breaks", () => {
    const onChange = vi.fn();
    render(<RichTextEditor value="" onChange={onChange} placeholder="نص الفقرة" />);
    field().focus();

    const clipboardData = {
      getData: (type: string) => (type === "text/html" ? "<p>فقرة أولى</p><p>فقرة ثانية</p>" : "فقرة أولى\nفقرة ثانية"),
    };
    fireEvent.paste(field(), { clipboardData });

    expect(onChange).toHaveBeenCalledWith("فقرة أولى\nفقرة ثانية");
  });

  it("a multi-line paste with no onSplitPaste falls back to one field with the breaks kept as \\n", () => {
    const onChange = vi.fn();
    render(<RichTextEditor value="" onChange={onChange} placeholder="نص الفقرة" />);
    field().focus();

    const clipboardData = { getData: (type: string) => (type === "text/plain" ? "فقرة أولى\n\nفقرة ثانية" : "") };
    fireEvent.paste(field(), { clipboardData });

    expect(onChange).toHaveBeenCalledWith("فقرة أولى\n\nفقرة ثانية");
  });

  it("a multi-paragraph paste hands each paragraph to onSplitPaste instead of landing in this field — regression: pasting a multi-paragraph article collapsed into one block", () => {
    const onChange = vi.fn();
    const onSplitPaste = vi.fn();
    render(<RichTextEditor value="" onChange={onChange} placeholder="نص الفقرة" onSplitPaste={onSplitPaste} />);
    field().focus();

    // Only the blank line between the first and second paragraph is a real
    // paragraph gap — the single break inside the second paragraph is a
    // WhatsApp-style soft wrap and stays inside that paragraph's own text.
    const clipboardData = { getData: (type: string) => (type === "text/plain" ? "فقرة أولى\n\nفقرة ثانية\nسطرها الثاني" : "") };
    fireEvent.paste(field(), { clipboardData });

    expect(onSplitPaste).toHaveBeenCalledWith("", ["فقرة أولى", "فقرة ثانية\nسطرها الثاني"], "");
    // Not also committed to this field's own value — it went to onSplitPaste instead.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("splits around the existing cursor position, not just at the start", () => {
    const onSplitPaste = vi.fn();
    render(<RichTextEditor value="قبل بعد" onChange={() => {}} onSplitPaste={onSplitPaste} placeholder="نص الفقرة" />);
    const el = field();
    const node = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode()!;
    const at = (node.textContent ?? "").indexOf("بعد");
    const range = document.createRange();
    range.setStart(node, at);
    range.collapse(true);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    const clipboardData = { getData: (type: string) => (type === "text/plain" ? "فقرة أولى\n\nفقرة ثانية" : "") };
    fireEvent.paste(el, { clipboardData });

    expect(onSplitPaste).toHaveBeenCalledWith("قبل ", ["فقرة أولى", "فقرة ثانية"], "بعد");
  });

  it("a paste with only single line breaks (no blank line) splits on every break — the client's 2026-09-09 note: a phone's clipboard flattens paragraph gaps to one break and the whole article landed as one block", () => {
    const onChange = vi.fn();
    const onSplitPaste = vi.fn();
    render(<RichTextEditor value="" onChange={onChange} onSplitPaste={onSplitPaste} placeholder="نص الفقرة" />);
    field().focus();

    const clipboardData = { getData: (type: string) => (type === "text/plain" ? "سطر أول\nسطر ثاني\nسطر ثالث" : "") };
    fireEvent.paste(field(), { clipboardData });

    expect(onSplitPaste).toHaveBeenCalledWith("", ["سطر أول", "سطر ثاني", "سطر ثالث"], "");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("a paste that has real blank lines keeps a single break inside a paragraph as a soft break — the per-line rule only applies when there is no paragraph gap to go by", () => {
    const onSplitPaste = vi.fn();
    render(<RichTextEditor value="" onChange={() => {}} onSplitPaste={onSplitPaste} placeholder="نص الفقرة" />);
    field().focus();

    const clipboardData = { getData: (type: string) => (type === "text/plain" ? "أولى\nتكملتها\n\nثانية" : "") };
    fireEvent.paste(field(), { clipboardData });

    expect(onSplitPaste).toHaveBeenCalledWith("", ["أولى\nتكملتها", "ثانية"], "");
  });

  /**
   * The phone path — a keyboard's clipboard chip (Gboard / Samsung Keyboard
   * clipboard history) never fires `paste`; the text arrives as a native
   * beforeinput, so these drive that event directly. jsdom's InputEvent
   * carries inputType/data; dataTransfer is stubbed where a test needs it.
   */
  const beforeInput = (el: HTMLElement, init: { inputType: string; data?: string | null; dataTransfer?: { getData: (t: string) => string } }) => {
    const ev = new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: init.inputType, data: init.data ?? null });
    if (init.dataTransfer) Object.defineProperty(ev, "dataTransfer", { value: init.dataTransfer });
    el.dispatchEvent(ev);
    return ev;
  };

  it("a phone keyboard's clipboard insert (beforeinput insertText carrying line breaks, no paste event) is split into blocks like a paste", () => {
    const onChange = vi.fn();
    const onSplitPaste = vi.fn();
    render(<RichTextEditor value="" onChange={onChange} onSplitPaste={onSplitPaste} placeholder="نص الفقرة" />);
    field().focus();

    const ev = beforeInput(field(), { inputType: "insertText", data: "فقرة أولى\nفقرة ثانية\nفقرة ثالثة" });

    expect(ev.defaultPrevented).toBe(true);
    expect(onSplitPaste).toHaveBeenCalledWith("", ["فقرة أولى", "فقرة ثانية", "فقرة ثالثة"], "");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("a beforeinput insertFromPaste takes its text off the event's dataTransfer and splits it the same way", () => {
    const onSplitPaste = vi.fn();
    render(<RichTextEditor value="" onChange={() => {}} onSplitPaste={onSplitPaste} placeholder="نص الفقرة" />);
    field().focus();

    const ev = beforeInput(field(), {
      inputType: "insertFromPaste",
      dataTransfer: { getData: (type) => (type === "text/plain" ? "أولى\n\nثانية" : "") },
    });

    expect(ev.defaultPrevented).toBe(true);
    expect(onSplitPaste).toHaveBeenCalledWith("", ["أولى", "ثانية"], "");
  });

  it("a paste that begins with a break, dropped at the end of a paragraph, starts a new block instead of gluing its first line onto that paragraph", () => {
    const onSplitPaste = vi.fn();
    render(<RichTextEditor value="قبل" onChange={() => {}} onSplitPaste={onSplitPaste} placeholder="نص الفقرة" />);
    const el = field();
    const node = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode()!;
    const range = document.createRange();
    range.setStart(node, 3);
    range.collapse(true);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    beforeInput(el, { inputType: "insertText", data: "\nأولى\nثانية" });

    expect(onSplitPaste).toHaveBeenCalledWith("قبل", ["", "أولى", "ثانية"], "");
  });

  it("leaves an ordinary keystroke's beforeinput to the browser", () => {
    const onSplitPaste = vi.fn();
    render(<RichTextEditor value="" onChange={() => {}} onSplitPaste={onSplitPaste} placeholder="نص الفقرة" />);
    field().focus();

    const ev = beforeInput(field(), { inputType: "insertText", data: "أ" });

    expect(ev.defaultPrevented).toBe(false);
    expect(onSplitPaste).not.toHaveBeenCalled();
  });

  it("turns an Android keyboard's Enter (beforeinput insertParagraph, no keydown Enter) into the same soft break the desktop Enter inserts", () => {
    const onChange = vi.fn();
    render(<RichTextEditor value="قبل" onChange={onChange} placeholder="نص الفقرة" />);
    const el = field();
    const node = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode()!;
    const range = document.createRange();
    range.setStart(node, 3);
    range.collapse(true);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    const ev = beforeInput(el, { inputType: "insertParagraph" });

    expect(ev.defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenCalledWith("قبل\n");
    expect(el.querySelector("div, br")).toBeNull();
  });

  it("a single-line paste with onSplitPaste set still lands in this field, not split", () => {
    const onChange = vi.fn();
    const onSplitPaste = vi.fn();
    render(<RichTextEditor value="" onChange={onChange} onSplitPaste={onSplitPaste} placeholder="نص الفقرة" />);
    field().focus();

    const clipboardData = { getData: (type: string) => (type === "text/plain" ? "نص ملصق" : "") };
    fireEvent.paste(field(), { clipboardData });

    expect(onChange).toHaveBeenCalledWith("نص ملصق");
    expect(onSplitPaste).not.toHaveBeenCalled();
  });

  it("hands the live field node out so the block header's actions can read its selection", () => {
    const seen: (HTMLDivElement | null)[] = [];
    const { unmount } = render(
      <RichTextEditor value="" onChange={() => {}} placeholder="نص الفقرة" registerField={(el) => seen.push(el)} />,
    );

    expect(seen.at(-1)).toBeInstanceOf(HTMLDivElement);
    unmount();
    expect(seen.at(-1)).toBeNull();
  });
});
