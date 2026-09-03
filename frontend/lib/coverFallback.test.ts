import { describe, expect, it } from "vitest";

import { articleCoverFallback, SITE_LOGO_SRC } from "./coverFallback";

describe("articleCoverFallback", () => {
  it("uses the author's avatar for an opinion piece that has one", () => {
    expect(articleCoverFallback("opinion", "/media/avatars/writer.jpg")).toEqual({
      src: "/media/avatars/writer.jpg",
      fit: "cover",
      position: "top",
    });
  });

  it("falls back to the site logo for an opinion piece with no avatar", () => {
    expect(articleCoverFallback("opinion", null)).toEqual({
      src: SITE_LOGO_SRC,
      fit: "contain",
      position: "center",
    });
    expect(articleCoverFallback("opinion", undefined)).toEqual({
      src: SITE_LOGO_SRC,
      fit: "contain",
      position: "center",
    });
  });

  it("falls back to the site logo for an ordinary news story, even one with an avatar to spare", () => {
    // The avatar fallback is an opinion-desk convention specifically — a
    // news story's identity is the story, not whoever filed it.
    expect(articleCoverFallback("news", "/media/avatars/writer.jpg")).toEqual({
      src: SITE_LOGO_SRC,
      fit: "contain",
      position: "center",
    });
  });

  it("falls back to the site logo when kind is unknown (a video card, say)", () => {
    expect(articleCoverFallback(undefined, "/media/avatars/writer.jpg")).toEqual({
      src: SITE_LOGO_SRC,
      fit: "contain",
      position: "center",
    });
  });
});
