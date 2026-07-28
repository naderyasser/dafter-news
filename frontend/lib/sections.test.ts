import { describe, expect, it } from "vitest";

import { ACCENT, SECTION_IDENTITY, sectionColor, sectionStyle } from "./sections";

/** WCAG relative luminance → contrast ratio against paper white. */
function contrastOnWhite(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (luminance + 0.05);
}

describe("sectionColor", () => {
  it("gives each section its own colour", () => {
    // The client's worked example: «درجات اللون الأخضر لقسم الرياضة».
    expect(sectionColor("sports")).toBe(SECTION_IDENTITY.sports.color);
    expect(sectionColor("sports")).not.toBe(sectionColor("art"));
  });

  it("falls back to the accent blue for a section it has never heard of", () => {
    // Sections come from the dashboard, so an unmapped key is a normal state,
    // not an error — it must not render an empty colour.
    expect(sectionColor("brand-new-section")).toBe(ACCENT);
    expect(sectionColor(undefined)).toBe(ACCENT);
    expect(sectionColor(null)).toBe(ACCENT);
  });

  it("keeps every section colour legible as body text", () => {
    // These are painted onto the kicker above each card headline, which is
    // text — 4.5:1 on paper white is the floor, not a nice-to-have.
    for (const [key, identity] of Object.entries(SECTION_IDENTITY)) {
      expect(contrastOnWhite(identity.color), `${key} (${identity.color})`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastOnWhite(ACCENT)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("sectionStyle", () => {
  it("exposes the section colour as the rule's second tone", () => {
    const style = sectionStyle("sports") as Record<string, string>;

    expect(style["--rule-b"]).toBe(SECTION_IDENTITY.sports.color);
  });

  it("strokes the watermark in the section's own colour", () => {
    // regression: a greyscale mark under a coloured heading reads as a
    // rendering fault, which is why the SVG is inlined rather than served as
    // a static file that could only ever be one colour.
    const style = sectionStyle("sports") as Record<string, string>;
    const decoded = decodeURIComponent(style["--wm-image"]);

    expect(decoded).toContain(SECTION_IDENTITY.sports.color);
    expect(decoded).toContain("<svg");
  });

  it("gives an unmapped section a colour but no watermark", () => {
    const style = sectionStyle("brand-new-section") as Record<string, string>;

    expect(style["--rule-b"]).toBe(ACCENT);
    expect(style["--wm-image"]).toBeUndefined();
  });

  it("keeps the watermark faint enough to stay behind the text", () => {
    const style = sectionStyle("economy") as Record<string, string>;

    expect(Number(style["--wm-opacity"])).toBeLessThanOrEqual(0.12);
  });
});
