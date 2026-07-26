import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StatusBadge from "./StatusBadge";

describe("StatusBadge", () => {
  it.each([
    ["published", "منشور"],
    ["draft", "مسودة"],
    ["review", "قيد المراجعة"],
    ["scheduled", "مجدول"],
    ["rejected", "مرفوض"],
    ["active", "مفعّل"],
    ["paused", "متوقف"],
    ["admin", "مدير"],
    ["editor", "محرر"],
    ["author", "كاتب"],
    ["moderator", "مشرف تعليقات"],
    ["pending", "معلّق"],
    ["approved", "مقبول"],
    ["banned", "محظور"],
  ])("renders the Arabic label for %s", (status, label) => {
    render(<StatusBadge status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("falls back to draft for an unknown status rather than rendering blank", () => {
    render(<StatusBadge status="totally-unknown" />);

    expect(screen.getByText("مسودة")).toBeInTheDocument();
  });

  it("uses the up token for published and the down token for rejected", () => {
    // Brief §8.4: منشور is green, مرفوض is red-tinted — and per §10.3 the
    // status colours come from the up/down tokens, not the brand red.
    const { container: published } = render(<StatusBadge status="published" />);
    const { container: rejected } = render(<StatusBadge status="rejected" />);

    expect(published.firstElementChild?.className).toContain("bg-up-tint");
    expect(published.firstElementChild?.className).toContain("text-up");
    expect(rejected.firstElementChild?.className).toContain("bg-down-tint");
    expect(rejected.firstElementChild?.className).toContain("text-down");
  });

  it("never wraps onto a second line inside a dense table row", () => {
    const { container } = render(<StatusBadge status="moderator" />);

    expect(container.firstElementChild?.className).toContain("whitespace-nowrap");
  });
});
