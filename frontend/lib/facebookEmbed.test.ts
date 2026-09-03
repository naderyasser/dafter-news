import { describe, expect, it } from "vitest";

import { facebookEmbedSrc, normalizeFacebookUrl } from "./facebookEmbed";

describe("facebookEmbedSrc", () => {
  it("points at Facebook's public video plugin, not the Graph API", () => {
    const src = facebookEmbedSrc("https://www.facebook.com/reel/123");
    const url = new URL(src);

    expect(url.origin + url.pathname).toBe("https://www.facebook.com/plugins/video.php");
  });

  it("carries the reel's own URL as the href parameter", () => {
    const src = facebookEmbedSrc("https://www.facebook.com/reel/123");

    expect(new URL(src).searchParams.get("href")).toBe("https://www.facebook.com/reel/123");
  });

  it("normalizes the URL before it ever reaches the href parameter", () => {
    // Regression: the plugin answered a request built from a share link's
    // own tracking query string with Facebook's "Video Unavailable" error —
    // verified live — even though the same reel plays fine on Facebook
    // itself. This must never reach the plugin un-normalized.
    const src = facebookEmbedSrc("https://m.facebook.com/reel/123?mibextid=abc123XYZ");

    expect(new URL(src).searchParams.get("href")).toBe("https://www.facebook.com/reel/123");
  });

  it("asks for autoplay and hides Facebook's own caption panel", () => {
    const params = new URL(facebookEmbedSrc("https://www.facebook.com/reel/123")).searchParams;

    expect(params.get("autoplay")).toBe("true");
    expect(params.get("show_text")).toBe("false");
  });

  it("defaults to a comfortable phone-sized hint", () => {
    const params = new URL(facebookEmbedSrc("https://www.facebook.com/reel/123")).searchParams;

    expect(params.get("width")).toBe("384");
    expect(params.get("height")).toBe("683");
  });

  it("takes an explicit size when the caller wants a different one", () => {
    const params = new URL(
      facebookEmbedSrc("https://www.facebook.com/reel/123", { width: 212, height: 377 }),
    ).searchParams;

    expect(params.get("width")).toBe("212");
    expect(params.get("height")).toBe("377");
  });
});

describe("normalizeFacebookUrl", () => {
  it("strips a tracking query string", () => {
    // Facebook's own redirects tack rdid/share_url onto a resolved share
    // link, and a share sheet adds mibextid — neither is something the
    // plugin needs, verified live against a real reel.
    expect(normalizeFacebookUrl("https://www.facebook.com/reel/123?mibextid=abc")).toBe(
      "https://www.facebook.com/reel/123",
    );
  });

  it("strips a fragment", () => {
    expect(normalizeFacebookUrl("https://www.facebook.com/reel/123#comments")).toBe(
      "https://www.facebook.com/reel/123",
    );
  });

  it("folds the mobile host onto www", () => {
    expect(normalizeFacebookUrl("https://m.facebook.com/reel/123")).toBe("https://www.facebook.com/reel/123");
  });

  it("folds the bare host onto www", () => {
    expect(normalizeFacebookUrl("https://facebook.com/reel/123")).toBe("https://www.facebook.com/reel/123");
  });

  it("leaves an already-clean URL untouched", () => {
    expect(normalizeFacebookUrl("https://www.facebook.com/reel/123")).toBe("https://www.facebook.com/reel/123");
  });

  it("falls back to the raw input when it isn't a parseable URL", () => {
    // Must never be what stops a link from reaching the plugin — the plugin
    // itself is the thing that gets to say a link doesn't work.
    expect(normalizeFacebookUrl("not a url")).toBe("not a url");
  });
});
