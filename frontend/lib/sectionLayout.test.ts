import { describe, expect, it } from "vitest";

import { sectionLayout } from "./sectionLayout";

/**
 * The mapping IS the client's «تصميم فريد لكل قسم» — if a section quietly
 * loses its archetype or its opening module, the page silently reverts to
 * looking like every other one, which is exactly the complaint this
 * answered. These pin each desk to what it was promised.
 */
describe("sectionLayout", () => {
  it("opens the market desk with prices and the sports desk with fixtures", () => {
    expect(sectionLayout("economy").top).toBe("markets");
    expect(sectionLayout("sports").top).toBe("matches");
  });

  it("opens the video desk with a player and the opinion desk with its columnists", () => {
    expect(sectionLayout("video").top).toBe("videos");
    expect(sectionLayout("opinion").top).toBe("columnists");
  });

  it("gives both geographic desks the filterable archetype", () => {
    expect(sectionLayout("gulf").archetype).toBe("geographic");
    expect(sectionLayout("world").archetype).toBe("geographic");
  });

  it("gives the long-form desks the magazine archetype", () => {
    for (const key of ["art", "guide"]) {
      expect(sectionLayout(key).archetype).toBe("magazine");
    }
  });

  it("puts «ملف خاص» on the cinema stage — the client's poster reference", () => {
    expect(sectionLayout("special").archetype).toBe("showcase");
  });

  it("gives the fast-news desks the newswire archetype and no opening module", () => {
    for (const key of ["pol", "egypt", "security", "tech"]) {
      expect(sectionLayout(key)).toEqual({ archetype: "newswire", top: null });
    }
  });

  it("falls back to newswire for a section added in the dashboard later", () => {
    // A new section must never render a blank page just because nobody
    // remembered to add it here.
    expect(sectionLayout("brand-new-desk")).toEqual({ archetype: "newswire", top: null });
    expect(sectionLayout(null)).toEqual({ archetype: "newswire", top: null });
    expect(sectionLayout(undefined)).toEqual({ archetype: "newswire", top: null });
  });
});
