import { describe, expect, it } from "vitest";

import { isHiddenSection, REELS_HIDDEN, VIDEO_DESK_HIDDEN, visibleSections } from "./hiddenDesks";

/**
 * These assert the MECHANISM against whatever the flags currently say, not
 * the settings themselves — so bringing «لقطة وتعليق» or «حصل إيه؟» back is
 * still the one-line flag flip it is meant to be, with no test to update
 * alongside it.
 */
describe("hiddenDesks", () => {
  const desks = [
    { key: "pol", name: "سياسة" },
    { key: "video", name: "لقطة وتعليق" },
    { key: "opinion", name: "بالعقل والمنطق" },
  ];

  it("hides the video desk exactly when its flag says so", () => {
    expect(isHiddenSection("video")).toBe(VIDEO_DESK_HIDDEN);
  });

  it("never hides a desk that isn't flagged", () => {
    for (const key of ["pol", "opinion", "egypt", "sports"]) {
      expect(isHiddenSection(key)).toBe(false);
    }
  });

  it("treats a missing key as visible rather than throwing", () => {
    expect(isHiddenSection(null)).toBe(false);
    expect(isHiddenSection(undefined)).toBe(false);
  });

  it("drops only the hidden desk from a section list, keeping the rest in order", () => {
    const visible = visibleSections(desks);

    expect(visible.some((s) => s.key === "video")).toBe(!VIDEO_DESK_HIDDEN);
    // Everything else survives untouched — the filter must not reorder or
    // drop desks that were never hidden.
    expect(visible.filter((s) => s.key !== "video").map((s) => s.key)).toEqual(["pol", "opinion"]);
  });

  it("leaves a list with no hidden desk in it completely alone", () => {
    const others = desks.filter((s) => s.key !== "video");

    expect(visibleSections(others)).toEqual(others);
  });

  it("exposes the reels shelf as its own switch, independent of the video desk", () => {
    // They are hidden together today but are separate features — a reel is a
    // Facebook embed, a video is a hosted file — so one can come back
    // without the other.
    expect(typeof REELS_HIDDEN).toBe("boolean");
    expect(typeof VIDEO_DESK_HIDDEN).toBe("boolean");
  });
});
