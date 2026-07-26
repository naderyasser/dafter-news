import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StatCard from "./StatCard";

describe("StatCard", () => {
  it("renders the label, value and change chip", () => {
    render(<StatCard label="زيارات اليوم" value="48,204" changeLabel="▲ 4.2%" up />);

    expect(screen.getByText("زيارات اليوم")).toBeInTheDocument();
    expect(screen.getByText("48,204")).toBeInTheDocument();
    expect(screen.getByText("▲ 4.2%")).toBeInTheDocument();
  });

  it("gives the value tabular figures", () => {
    // Brief §3 / §10.6: every number in a data context takes tabular-nums,
    // so digits don't jitter as counts update.
    render(<StatCard label="مقالات" value="312" changeLabel="▲ 12" up />);

    expect(screen.getByText("312").className).toContain("tnum");
  });

  it("gives the change chip tabular figures too", () => {
    render(<StatCard label="مقالات" value="312" changeLabel="▲ 12" up />);

    expect(screen.getByText("▲ 12").className).toContain("tnum");
  });

  it("uses the up token when the metric rose", () => {
    render(<StatCard label="زيارات" value="1" changeLabel="▲ 4%" up />);

    const chip = screen.getByText("▲ 4%");
    expect(chip.className).toContain("bg-up-tint");
    expect(chip.className).toContain("text-up");
  });

  it("uses the down token when the metric fell", () => {
    // §10.3 forbids reusing the brand red for a decline.
    render(<StatCard label="تعليقات" value="27" changeLabel="▼ 5" up={false} />);

    const chip = screen.getByText("▼ 5");
    expect(chip.className).toContain("bg-down-tint");
    expect(chip.className).toContain("text-down");
    expect(chip.className).not.toContain("text-brand");
  });

  it("accepts a numeric value", () => {
    render(<StatCard label="عدد" value={9842} changeLabel="▲ 8.1%" up />);

    expect(screen.getByText("9842")).toBeInTheDocument();
  });
});
