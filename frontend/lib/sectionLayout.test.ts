import { describe, expect, it } from "vitest";

import { sectionFront, sectionTagline } from "./sectionLayout";

/**
 * The mapping is the client's 2026-09-09 note taken literally: one grid for
 * every article desk, so «عرض المزيد» on any of them lands on the same page
 * shape. The test that matters most is the one asserting no article desk
 * has quietly grown a front of its own again.
 */
describe("sectionFront", () => {
  const DESKS = ["pol", "egypt", "gulf", "world", "economy", "sports", "security", "tech", "art", "special", "guide", "video", "opinion"];
  const ARTICLE_DESKS = ["pol", "egypt", "gulf", "world", "security", "tech", "art", "special", "guide"];

  it("puts every article desk on the one news grid", () => {
    for (const key of ARTICLE_DESKS) {
      expect(sectionFront(key).front, key).toBe("news");
    }
  });

  it("keeps the data mastheads and the two different content types on their own fronts", () => {
    expect(sectionFront("economy").front).toBe("markets");
    expect(sectionFront("sports").front).toBe("sports");
    expect(sectionFront("video").front).toBe("watch");
    expect(sectionFront("opinion").front).toBe("opinion");
  });

  it("asks for the extra feed only where a front actually renders one", () => {
    expect(sectionFront("economy").feed).toBe("markets");
    expect(sectionFront("sports").feed).toBe("matches");
    expect(sectionFront("video").feed).toBe("videos");
    // Everything else must not pay for a request it will not use.
    const others = DESKS.filter((k) => !["economy", "sports", "video"].includes(k));
    for (const key of others) expect(sectionFront(key).feed).toBeNull();
  });

  it("drops the most-read rail on the two desks that own their full width, and keeps it everywhere else", () => {
    for (const key of ["video", "opinion"]) {
      expect(sectionFront(key).aside).toBe(false);
    }
    // «ملف خاص» refused the rail while it was a dark full-bleed page; on the
    // shared grid it takes it like every other article desk.
    for (const key of [...ARTICLE_DESKS, "economy", "sports"]) {
      expect(sectionFront(key).aside, key).toBe(true);
    }
  });

  it("gives a section added in the dashboard later the same news grid, never a blank page", () => {
    const fallback = { front: "news", feed: null, aside: true };
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
