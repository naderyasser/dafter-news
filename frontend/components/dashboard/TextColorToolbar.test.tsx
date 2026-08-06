import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TextColorToolbar from "./TextColorToolbar";

/**
 * TextColorToolbar is purely presentational now — RichTextEditor owns the
 * selection and the actual DOM mutation (see richTextDom.test.ts and
 * RichTextEditor.test.tsx for that half). These tests only check that the
 * right button forwards the right (kind, colour) pair, and that the "clear"
 * control's visibility tracks whether `value` actually carries formatting.
 */
const openPanel = () => fireEvent.click(screen.getByRole("button", { name: /تلوين النص/ }));

describe("TextColorToolbar", () => {
  it("forwards a swatch pick as (kind, colour)", () => {
    const onApply = vi.fn();
    render(<TextColorToolbar value="نص" onApply={onApply} onClear={vi.fn()} />);
    openPanel();

    fireEvent.click(screen.getByLabelText("لون النص: أحمر الهوية"));

    expect(onApply).toHaveBeenCalledWith("c", "#B01F2E");
  });

  it("forwards a highlight pick with kind \"h\"", () => {
    const onApply = vi.fn();
    render(<TextColorToolbar value="نص" onApply={onApply} onClear={vi.fn()} />);
    openPanel();

    fireEvent.click(screen.getByLabelText("تظليل: أصفر"));

    expect(onApply).toHaveBeenCalledWith("h", "#FFF3B0");
  });

  it("forwards bold/italic/underline with no colour value, no panel needed", () => {
    const onApply = vi.fn();
    render(<TextColorToolbar value="نص" onApply={onApply} onClear={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("نص غامق"));
    fireEvent.click(screen.getByLabelText("نص مائل"));
    fireEvent.click(screen.getByLabelText("نص تحته خط"));

    expect(onApply).toHaveBeenNthCalledWith(1, "b");
    expect(onApply).toHaveBeenNthCalledWith(2, "i");
    expect(onApply).toHaveBeenNthCalledWith(3, "u");
  });

  it("forwards «فقرة» with kind \"L\", no colour value, no panel needed", () => {
    const onApply = vi.fn();
    render(<TextColorToolbar value="نص" onApply={onApply} onClear={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("فقرة"));

    expect(onApply).toHaveBeenCalledWith("L");
  });

  it("passes a custom picker colour straight through", () => {
    const onApply = vi.fn();
    render(<TextColorToolbar value="نص" onApply={onApply} onClear={vi.fn()} />);
    openPanel();

    fireEvent.change(screen.getByLabelText("لون مخصّص للنص"), { target: { value: "#123abc" } });

    expect(onApply).toHaveBeenCalledWith("c", "#123abc");
  });

  it("hides the clear control until the value actually carries formatting", () => {
    const { rerender } = render(<TextColorToolbar value="نص عادي" onApply={vi.fn()} onClear={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "إزالة التلوين" })).not.toBeInTheDocument();

    rerender(<TextColorToolbar value="{b|غامق}" onApply={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByRole("button", { name: "إزالة التلوين" })).toBeInTheDocument();
  });

  it("calls onClear when the clear control is pressed", () => {
    const onClear = vi.fn();
    render(<TextColorToolbar value="{c:#B01F2E|أحمر}" onApply={vi.fn()} onClear={onClear} />);

    fireEvent.click(screen.getByRole("button", { name: "إزالة التلوين" }));

    expect(onClear).toHaveBeenCalledOnce();
  });

  it("offers the site's own palette rather than an open field first", () => {
    render(<TextColorToolbar value="نص" onApply={vi.fn()} onClear={vi.fn()} />);
    openPanel();

    expect(screen.getByLabelText("لون النص: أزرق الهوية")).toBeInTheDocument();
    expect(screen.getByLabelText("لون النص: أحمر الهوية")).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^لون النص: /)).toHaveLength(6);
  });
});
