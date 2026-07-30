import { describe, expect, it } from "vitest";

import { sectionFront, sectionTagline } from "./sectionLayout";

/**
 * The mapping IS the client's «تصميم فريد لكل قسم». The complaint that
 * produced these fronts was that thirteen desks shared four layouts and were
 * told apart only by an accent colour — so the test that matters most is the
 * one asserting no two desks share a front again.
 */
describe("sectionFront", () => {
  const DESKS = ["pol", "egypt", "gulf", "world", "economy", "sports", "security", "tech", "art", "special", "guide", "video", "opinion"];

  it("gives every desk a front of its own", () => {
    const fronts = DESKS.map((key) => sectionFront(key).front);
    expect(new Set(fronts).size).toBe(DESKS.length);
  });

  it("never leaves a desk on the newswire fallback", () => {
    // `newswire` exists for sections created in the dashboard later. A named
    // desk landing on it means someone added a section here and forgot the
    // component — which looks exactly like the bug this replaced.
    for (const key of DESKS) {
      expect(sectionFront(key).front).not.toBe("newswire");
    }
  });

  it("asks for the extra feed only where a front actually renders one", () => {
    expect(sectionFront("economy").feed).toBe("markets");
    expect(sectionFront("sports").feed).toBe("matches");
    expect(sectionFront("video").feed).toBe("videos");
    // Everything else must not pay for a request it will not use.
    const others = DESKS.filter((k) => !["economy", "sports", "video"].includes(k));
    for (const key of others) expect(sectionFront(key).feed).toBeNull();
  });

  it("drops the most-read rail on the three desks that own their full width", () => {
    for (const key of ["special", "video", "opinion"]) {
      expect(sectionFront(key).aside).toBe(false);
    }
    for (const key of ["pol", "egypt", "economy", "art"]) {
      expect(sectionFront(key).aside).toBe(true);
    }
  });

  it("falls back to a working page for a section added in the dashboard later", () => {
    // A new section must never render a blank page just because nobody
    // remembered to add it here.
    const fallback = { front: "newswire", feed: null, aside: true };
    expect(sectionFront("brand-new-desk")).toEqual(fallback);
    expect(sectionFront(null)).toEqual(fallback);
    expect(sectionFront(undefined)).toEqual(fallback);
  });
});

describe("sectionTagline", () => {
  it("gives every mapped desk a line in both editions", () => {
    for (const key of ["pol", "egypt", "economy", "sports", "art", "opinion"]) {
      expect(sectionTagline(key, "ar")).toBeTruthy();
      expect(sectionTagline(key, "en")).toBeTruthy();
    }
  });

  it("gives a dashboard-created section none rather than a generated platitude", () => {
    expect(sectionTagline("brand-new-desk", "ar")).toBeUndefined();
    expect(sectionTagline(null, "ar")).toBeUndefined();
  });
});
