/**
 * The YouTube side of «حصل إيه؟» — the reel shelf plays through YouTube's
 * own iframe player, which needs no API key, no SDK script on the page and
 * no account on our side. The backend (video/youtube.py) derives the video
 * id from whatever link the newsroom pasted; everything here is built from
 * that id alone.
 */

/** A YouTube video id is exactly eleven URL-safe base64 characters. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function isYoutubeId(id: string | null | undefined): id is string {
  return typeof id === "string" && VIDEO_ID.test(id);
}

/**
 * The player's src.
 *
 * `youtube-nocookie.com` is YouTube's own privacy-enhanced host: the same
 * player, but it sets no tracking cookies until the reader actually presses
 * play — the right default for a news site embedding third-party video on
 * every visit to the home page.
 *
 * `playsinline` keeps iOS from hijacking the frame into its own full-screen
 * player, `rel=0` limits the end-screen suggestions to the same channel, and
 * `autoplay` is only asked for where the reader has just pressed a card —
 * the lightbox and the watch page — never on a card sitting in a rail.
 */
export function youtubeEmbedSrc(videoId: string, { autoplay = false } = {}): string {
  const params = new URLSearchParams({
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
  });
  if (autoplay) params.set("autoplay", "1");
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

/** The video's own page on YouTube — the honest "watch it there" link. */
export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

/**
 * The permission set YouTube's own embed code asks for. `web-share` and
 * `clipboard-write` are what the player's in-frame Share control needs.
 */
export const YOUTUBE_IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
