import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import RichTextEditor from "./RichTextEditor";

/**
 * The point of this field is that an editor never has to look at
 * `{c:#hex|…}` to know a word is coloured — the box itself shows the colour.
 * These tests drive it the way an editor would: type, select, pick a
 * colour, and check what's actually on screen (not the stored value, which
 * TextColorToolbar.test.tsx already covers).
 */
function Host({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <RichTextEditor value={value} onChange={setValue} placeholder="نص الفقرة" />;
}

beforeEach(() => {
  // TextColorToolbar re-selects on the next frame after applying a colour.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("RichTextEditor", () => {
  it("opens straight into the textarea when there's nothing written yet", () => {
    render(<Host />);
    expect(screen.getByPlaceholderText("نص الفقرة")).toBeVisible();
  });

  it("shows existing text as a coloured preview, not the raw {c:#hex|…} token", () => {
    render(<Host initial="قبل {c:#B01F2E|أحمر} بعد" />);

    expect(screen.getByText("أحمر")).toHaveStyle({ color: "rgb(176, 31, 46)" });
    // The visible preview reads clean — the raw markup only ever lives in
    // the (present but hidden) textarea underneath, for actual editing.
    expect(screen.getByTitle("اضغط للتحرير").textContent).not.toContain("{c:#");
    expect(screen.getByPlaceholderText("نص الفقرة")).not.toBeVisible();
  });

  it("switches to the textarea on click, for typing", async () => {
    render(<Host initial="نص عادي" />);

    await act(async () => screen.getByTitle("اضغط للتحرير").click());

    expect(screen.getByPlaceholderText("نص الفقرة")).toBeVisible();
  });

  it("applying a colour flips straight back to the coloured preview — no hex to read", async () => {
    render(<Host initial="أسعار الفائدة ترتفع" />);

    // Get to the raw textarea, select the first two words, colour them.
    await act(async () => screen.getByTitle("اضغط للتحرير").click());
    const textarea = screen.getByPlaceholderText("نص الفقرة") as HTMLTextAreaElement;
    textarea.setSelectionRange(0, 13);

    await act(async () => screen.getByRole("button", { name: /تلوين النص/ }).click());
    await act(async () => screen.getByLabelText("لون النص: أحمر الهوية").click());

    // Back to the read view, showing the colour rather than the markup.
    expect(screen.getByTitle("اضغط للتحرير").textContent).not.toContain("{c:#");
    expect(screen.getByText("أسعار الفائدة")).toHaveStyle({ color: "rgb(176, 31, 46)" });
    expect(textarea).not.toBeVisible();
  });

  it("hands the live textarea node out so the block header's actions can read its selection", () => {
    const seen: (HTMLTextAreaElement | null)[] = [];
    const { unmount } = render(<RichTextEditor value="" onChange={() => {}} placeholder="نص الفقرة" registerTextarea={(el) => seen.push(el)} />);

    expect(seen.at(-1)).toBeInstanceOf(HTMLTextAreaElement);
    unmount();
    expect(seen.at(-1)).toBeNull();
  });
});
