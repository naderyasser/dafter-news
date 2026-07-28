import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Chevron from "./Chevron";

const svg = (c: HTMLElement) => c.querySelector("svg")!;
/** The path is drawn pointing right; `-scale-x-100` is the only thing that turns it. */
const pointsLeft = (c: HTMLElement) => svg(c).classList.contains("-scale-x-100");

describe("Chevron", () => {
  it("points the way the page reads", () => {
    // Forward is left in Arabic and right in English. This is the whole bug:
    // «اقرأ الخبر ›» used to send the eye right, away from where the link goes.
    expect(pointsLeft(render(<Chevron lang="ar" />).container)).toBe(true);
    expect(pointsLeft(render(<Chevron lang="en" />).container)).toBe(false);
  });

  it("points back the other way", () => {
    expect(pointsLeft(render(<Chevron lang="ar" dir="back" />).container)).toBe(false);
    expect(pointsLeft(render(<Chevron lang="en" dir="back" />).container)).toBe(true);
  });

  it("is an SVG, never a mirrored character", () => {
    // regression: `›` and `←` carry Unicode's Bidi_Mirrored property, so the
    // browser flips them in RTL on its own. The code flipped them a second
    // time and the two cancelled. SVG geometry is not touched by the bidi
    // algorithm, so one explicit rule works for both editions.
    const { container } = render(<Chevron lang="ar" />);

    expect(svg(container)).toBeInTheDocument();
    expect(container.textContent).toBe("");
    expect(container.textContent).not.toMatch(/[›‹←→]/);
  });

  it("stays out of the accessibility tree", () => {
    // The link beside it already says where it goes.
    const { container } = render(<Chevron lang="ar" />);

    expect(svg(container)).toHaveAttribute("aria-hidden", "true");
    expect(svg(container)).toHaveAttribute("focusable", "false");
  });

  it("takes a size from the caller and falls back to the text size", () => {
    expect(svg(render(<Chevron lang="ar" className="h-4 w-4" />).container).classList).toContain("h-4");
    expect(svg(render(<Chevron lang="ar" />).container).classList).toContain("h-[1em]");
  });
});
