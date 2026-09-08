import { describe, expect, it } from "vitest";

import { isYoutubeId, youtubeEmbedSrc, youtubeWatchUrl } from "./youtube";

describe("youtubeEmbedSrc", () => {
  it("points at YouTube's privacy-enhanced player host, by video id", () => {
    const url = new URL(youtubeEmbedSrc("eF44mfjFjW8"));

    expect(url.origin).toBe("https://www.youtube-nocookie.com");
    expect(url.pathname).toBe("/embed/eF44mfjFjW8");
  });

  it("asks for inline playback and same-channel suggestions only", () => {
    const params = new URL(youtubeEmbedSrc("eF44mfjFjW8")).searchParams;

    expect(params.get("playsinline")).toBe("1");
    expect(params.get("rel")).toBe("0");
  });

  it("never autoplays unless the caller says the reader asked for it", () => {
    expect(new URL(youtubeEmbedSrc("eF44mfjFjW8")).searchParams.get("autoplay")).toBeNull();
    expect(new URL(youtubeEmbedSrc("eF44mfjFjW8", { autoplay: true })).searchParams.get("autoplay")).toBe("1");
  });

  it("encodes the id so nothing in it can escape the path", () => {
    expect(youtubeEmbedSrc("a/b?c")).toContain("/embed/a%2Fb%3Fc?");
  });
});

describe("youtubeWatchUrl", () => {
  it("is the canonical watch page for the id", () => {
    expect(youtubeWatchUrl("eF44mfjFjW8")).toBe("https://www.youtube.com/watch?v=eF44mfjFjW8");
  });
});

describe("isYoutubeId", () => {
  it("accepts exactly eleven URL-safe characters", () => {
    expect(isYoutubeId("eF44mfjFjW8")).toBe(true);
    expect(isYoutubeId("a-b_c-d_e-f")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isYoutubeId("")).toBe(false);
    expect(isYoutubeId(null)).toBe(false);
    expect(isYoutubeId("too-short")).toBe(false);
    expect(isYoutubeId("has spaces!!")).toBe(false);
  });
});
