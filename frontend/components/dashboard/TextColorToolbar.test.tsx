import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";

import TextColorToolbar from "./TextColorToolbar";
import { parseInline } from "@/lib/richtext";

/**
 * The colour tokens are the one place an editor's keystrokes reach the public
 * page as *formatting*, so this file guards both halves of that bargain: the
 * grammar the toolbar writes must be the grammar the shared parser reads, and
 * the token must stay plain text — no HTML is produced anywhere along the
 * path, which is why the article body never needs dangerouslySetInnerHTML.
 */
function harness(initial: string, selection: [number, number]) {
  const ref = createRef<HTMLTextAreaElement>();
  const onChange = vi.fn();
  const Host = ({ value }: { value: string }) => (
    <>
      <textarea ref={ref} defaultValue={value} readOnly aria-label="body" />
      <TextColorToolbar value={value} onChange={onChange} textareaRef={ref as never} />
    </>
  );
  const view = render(<Host value={initial} />);
  const el = ref.current!;
  el.setSelectionRange(selection[0], selection[1]);
  return { onChange, el, view };
}

const openPanel = async () => {
  await act(async () => screen.getByRole("button", { name: /تلوين النص/ }).click());
};

beforeEach(() => {
  // The component defers the reselect to the next frame.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("TextColorToolbar", () => {
  it("wraps the selection in a token the parser can read back", async () => {
    const { onChange } = harness("أسعار الفائدة ترتفع", [0, 13]);
    await openPanel();

    await act(async () => screen.getByLabelText("لون النص: أحمر الهوية").click());

    expect(onChange).toHaveBeenCalledWith("{c:#B01F2E|أسعار الفائدة} ترتفع");
  });

  it("highlights with the same grammar, only a different kind", async () => {
    const { onChange } = harness("أسعار الفائدة ترتفع", [0, 13]);
    await openPanel();

    await act(async () => screen.getByLabelText("تظليل: أصفر").click());

    expect(onChange).toHaveBeenCalledWith("{h:#FFF3B0|أسعار الفائدة} ترتفع");
  });

  it("refuses to colour an empty selection instead of planting a hollow token", async () => {
    const alert = vi.fn();
    vi.stubGlobal("alert", alert);
    const { onChange } = harness("أسعار الفائدة", [4, 4]);
    await openPanel();

    await act(async () => screen.getByLabelText("لون النص: أزرق الهوية").click());

    expect(onChange).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith("حدّد النص الذي تريد تلوينه أولاً.");
  });

  it("folds a second colour into the same token rather than nesting one inside it", async () => {
    // The reselect leaves exactly the inner text selected, so this is what a
    // colour-then-highlight sequence actually produces. Nesting would emit a
    // token the shared parser cannot read, and it used to leak to the public
    // article page as literal markup.
    const value = "{c:#B01F2E|أسعار الفائدة} ترتفع";
    const { onChange } = harness(value, [value.indexOf("أسعار"), value.indexOf("}")]);
    await openPanel();

    await act(async () => screen.getByLabelText("تظليل: أصفر").click());

    const next = onChange.mock.calls[0][0] as string;
    // One token carrying both pairs — the grammar chains prefixes, it does
    // not nest tokens.
    expect(next).toBe("{c:#B01F2E|h:#FFF3B0|أسعار الفائدة} ترتفع");
    expect(next).not.toMatch(/\{[ch]:#[0-9a-fA-F]{3,6}\|[^{}]*\{[ch]:/);

    // And the shared parser reads both back out of it — which is the whole
    // point of merging rather than nesting.
    expect(parseInline(next)[0]).toMatchObject({
      text: "أسعار الفائدة",
      color: "#B01F2E",
      background: "#FFF3B0",
    });
  });

  it("hides the clear control until there is something to clear", async () => {
    const { view } = harness("نص عادي", [0, 3]);

    expect(screen.queryByRole("button", { name: "إزالة التلوين" })).not.toBeInTheDocument();
    view.unmount();

    harness("{c:#B01F2E|ملوّن}", [0, 5]);
    expect(screen.getByRole("button", { name: "إزالة التلوين" })).toBeInTheDocument();
  });

  it("strips every token in the field when nothing is selected", async () => {
    const { onChange } = harness("{c:#B01F2E|أ} و {h:#FFF3B0|ب}", [0, 0]);

    await act(async () => screen.getByRole("button", { name: "إزالة التلوين" }).click());

    expect(onChange).toHaveBeenCalledWith("أ و ب");
  });

  it("strips only the tokens inside the selection", async () => {
    const value = "{c:#B01F2E|أ} و {h:#FFF3B0|ب}";
    const { onChange } = harness(value, [0, "{c:#B01F2E|أ}".length]);

    await act(async () => screen.getByRole("button", { name: "إزالة التلوين" }).click());

    expect(onChange).toHaveBeenCalledWith("أ و {h:#FFF3B0|ب}");
  });

  it("previews what the reader will see, as styled text and not as markup", () => {
    harness("{c:#B01F2E|عاجل} — بقية الخبر", [0, 0]);

    const word = screen.getByText("عاجل");
    expect(word).toHaveStyle({ color: "#B01F2E" });

    // The token must never survive into the preview itself. Scoped to the
    // preview box: the textarea beside it legitimately holds the raw source.
    const preview = screen.getByText("معاينة").parentElement!;
    expect(preview.textContent).toBe("معاينةعاجل — بقية الخبر");
    expect(preview.textContent).not.toContain("{c:#");
  });

  it("renders colour through React's style prop, never as markup", () => {
    // The reason the article body needs no dangerouslySetInnerHTML anywhere:
    // a hostile "colour" cannot escape into an attribute, because the parser's
    // own regex is a hex-only allow-list and never matched it to begin with.
    harness("{c:url(javascript:alert(1))|كلمة}", [0, 0]);

    // Unparsed, so it stays inert plain text rather than becoming a style.
    expect(screen.queryByRole("button", { name: "إزالة التلوين" })).not.toBeInTheDocument();
  });

  it("passes a custom picker colour straight through in the same grammar", async () => {
    const { onChange } = harness("كلمة", [0, 4]);
    await openPanel();

    await act(async () => {
      fireEvent.change(screen.getByLabelText("لون مخصّص للنص"), { target: { value: "#123abc" } });
    });

    expect(onChange).toHaveBeenCalledWith("{c:#123abc|كلمة}");
  });

  it("offers the site's own palette rather than an open field first", async () => {
    harness("كلمة", [0, 4]);
    await openPanel();

    // Brand blue and brand red lead — an editor colouring a word should be
    // reaching for a brand colour, with the free picker as the exception.
    expect(screen.getByLabelText("لون النص: أزرق الهوية")).toBeInTheDocument();
    expect(screen.getByLabelText("لون النص: أحمر الهوية")).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^لون النص: /)).toHaveLength(6);
  });

  it("wraps the selection in a bold flag with no colour value, no panel needed", async () => {
    const { onChange } = harness("أسعار الفائدة ترتفع", [0, 13]);

    await act(async () => screen.getByLabelText("نص غامق").click());

    expect(onChange).toHaveBeenCalledWith("{b|أسعار الفائدة} ترتفع");
  });

  it("applies italic and underline with the same grammar, one flag each", async () => {
    const { onChange: onChangeItalic, view: viewItalic } = harness("كلمة", [0, 4]);
    await act(async () => screen.getByLabelText("نص مائل").click());
    expect(onChangeItalic).toHaveBeenCalledWith("{i|كلمة}");
    viewItalic.unmount();

    const { onChange: onChangeUnderline } = harness("كلمة", [0, 4]);
    await act(async () => screen.getByLabelText("نص تحته خط").click());
    expect(onChangeUnderline).toHaveBeenCalledWith("{u|كلمة}");
  });

  it("refuses to bold an empty selection, naming what to do instead", async () => {
    const alert = vi.fn();
    vi.stubGlobal("alert", alert);
    const { onChange } = harness("أسعار الفائدة", [4, 4]);

    await act(async () => screen.getByLabelText("نص غامق").click());

    expect(onChange).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith("حدّد النص الذي تريد تنسيقه أولاً.");
  });

  it("folds bold into a colour token already open on the reselected text", async () => {
    const value = "{c:#B01F2E|أسعار الفائدة} ترتفع";
    const { onChange } = harness(value, [value.indexOf("أسعار"), value.indexOf("}")]);

    await act(async () => screen.getByLabelText("نص غامق").click());

    expect(onChange).toHaveBeenCalledWith("{c:#B01F2E|b|أسعار الفائدة} ترتفع");
  });

  it("shows the bold run in the preview without leaking the token", () => {
    harness("{b|عاجل} — بقية الخبر", [0, 0]);

    expect(screen.getByText("عاجل")).toHaveStyle({ fontWeight: "700" });
    const preview = screen.getByText("معاينة").parentElement!;
    expect(preview.textContent).toBe("معاينةعاجل — بقية الخبر");
  });
});
