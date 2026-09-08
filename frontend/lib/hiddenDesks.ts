/**
 * Desks the newsroom has taken off the public site — without deleting a
 * single row.
 *
 * «لقطة وتعليق» (the `video` desk and every /video route) and «حصل إيه؟»
 * (the reels shelf and every /reel route) can each be hidden from readers
 * with one flag, with their content, their sections and their dashboard
 * screens left exactly as they were. Nothing here deletes anything: the
 * videos, the reels and the `video` Section row all stay in the database,
 * the newsroom can still manage them under the dashboard, and the API still
 * serves them.
 *
 * TO BRING A DESK BACK: flip its flag below to `false`. That is the whole
 * restore — every surface reads this file rather than deciding for itself,
 * which is why the hiding is one edit rather than a hunt through forty
 * files, and why bringing it back is the same one edit in reverse.
 *
 * What each flag covers, so nothing is missed when one is flipped:
 *
 * `VIDEO_DESK_HIDDEN`
 *   - the «لقطة وتعليق» block on both home pages
 *   - the desk's own /section/video and /en/section/video fronts
 *   - /video, /video/[slug], /en/video/[slug]
 *   - the desk's entry in the header nav, the drawer and the footer
 *   - the section filter on both search pages
 *   - every /video and /section/video URL in the sitemap
 *
 * `REELS_HIDDEN`
 *   - the «حصل إيه؟» rail on both home pages
 *   - /reel/[slug] and /en/reel/[slug]
 *   - every reel URL in the sitemap
 */

export const VIDEO_DESK_HIDDEN = false;
// Back on: the shelf was taken off while it ran on Facebook embeds; it now
// plays YouTube Shorts (see components/site/ReelsRail.tsx) and is public.
export const REELS_HIDDEN = false;

/** The `Section.key` of the desk hidden by VIDEO_DESK_HIDDEN. */
const VIDEO_DESK_KEY = "video";

/** Whether this section key is currently hidden from readers. */
export function isHiddenSection(key: string | null | undefined): boolean {
  return VIDEO_DESK_HIDDEN && key === VIDEO_DESK_KEY;
}

/**
 * The sections a reader may actually see — every list of desks on the
 * public site (nav, drawer, footer, search filter, sitemap, the home page's
 * tail loop) runs through this, so a hidden desk cannot reappear in one of
 * them because that one was forgotten.
 */
export function visibleSections<T extends { key: string }>(sections: T[]): T[] {
  return sections.filter((s) => !isHiddenSection(s.key));
}
