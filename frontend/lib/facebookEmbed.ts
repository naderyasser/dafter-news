/**
 * Facebook's own public Video Plugin — not the Graph API the client cancelled
 * early in this project, and not their JS SDK either: a plain, documented
 * iframe endpoint meant for exactly this
 * (developers.facebook.com/docs/plugins/embedded-video-player), needing no
 * app id, no token and no extra script tag on the page.
 *
 * Confirmed against a real reel on this shelf before it was ever wired in: a
 * request to `/plugins/video.php?href=<the reel URL>` came back HTTP 200 with
 * the player's bootstrap payload carrying the exact video id from that URL,
 * so the plugin does resolve a `/reel/` link, not just the older `/videos/`
 * post shape. Whether Facebook actually SERVES the stream once the iframe
 * mounts is a separate, per-video question — some do, some answer with
 * Facebook's own "Video Unavailable" inside the frame, most often because the
 * page that posted it has not enabled embedding for that post. This function
 * only builds the request; it has no way to know which a given reel will be.
 *
 * `width`/`height` are a size hint to Facebook's own renderer, not the
 * frame's actual footprint — the iframe element itself is sized by ordinary
 * CSS on its own aspect-ratio box.
 *
 * Autoplay here always starts muted. That is Meta's own documented plugin
 * behaviour (the same docs page states plainly that `data-autoplay` "will be
 * played without sound"), not a gap in this call — there is no parameter
 * that overrides it, and no browser would honour one anyway: unmuted
 * autoplay is blocked platform-wide unless the reader has already interacted
 * with THIS SPECIFIC origin, which a freshly-mounted cross-origin iframe
 * never has.
 */
/** Mobile/legacy hosts folded onto the canonical `www.facebook.com` a reel
 *  link may arrive with — see normalizeFacebookUrl. */
const MOBILE_HOSTS = new Set(["facebook.com", "m.facebook.com", "web.facebook.com"]);

/**
 * The embeddable form of a Facebook URL — canonical host, no query string.
 *
 * Belt-and-suspenders for the dashboard's own scrape (video/og.py), which
 * already rewrites a reel's stored `facebook_url` to this same shape the
 * moment it is fetched — this is what makes a still-unnormalized link (an
 * older row from before that existed, a manual edit that only touched the
 * title) resolve the same way here instead of shipping the raw value to the
 * plugin.
 *
 * Query parameters are dropped outright rather than filtered: Facebook's own
 * redirects tack a `rdid`/`share_url` pair onto the URL a `/share/r/…` short
 * link resolves to, a share sheet adds `mibextid`, and none of it is
 * something `/plugins/video.php?href=` needs — confirmed live, a request
 * built with that tracking query string intact still loaded the real player.
 * `m.facebook.com` and bare `facebook.com` are folded onto `www.facebook.com`
 * on the same reasoning as the backend's own canonicalization: the plugin
 * gets built against the one host it was tested with.
 *
 * Falls back to the input untouched if it fails to parse as a URL at all —
 * this must never be what stops a valid link from reaching the plugin; the
 * plugin itself is the thing that gets to say a link doesn't work.
 */
export function normalizeFacebookUrl(pageUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(pageUrl);
  } catch {
    return pageUrl;
  }
  if (MOBILE_HOSTS.has(parsed.hostname.toLowerCase())) {
    parsed.hostname = "www.facebook.com";
  }
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

export function facebookEmbedSrc(pageUrl: string, { width = 384, height = 683 } = {}): string {
  const params = new URLSearchParams({
    href: normalizeFacebookUrl(pageUrl),
    show_text: "false",
    width: String(width),
    height: String(height),
    autoplay: "true",
  });
  return `https://www.facebook.com/plugins/video.php?${params.toString()}`;
}
