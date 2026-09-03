/**
 * What an article card shows in place of a missing cover photo.
 *
 * An opinion piece's identity IS its columnist — the newsroom's own
 * editorial call is that the writer's own photo is the right stand-in for a
 * missing cover there, the same way a print op-ed page runs a photo
 * byline. A news story has no such natural substitute, so it falls straight
 * to the site's own mark instead of reaching for an unrelated photo.
 *
 * Never used when a real `cover_image` exists — callers only reach for this
 * once that's already confirmed absent.
 */

/** The site's own brand mark — bundled as a static asset (also the
 *  favicon/app icon) rather than the dashboard-editable `settings.logo`, so
 *  a card never depends on a network fetch of site settings just to have
 *  something to show. */
export const SITE_LOGO_SRC = "/icon.png";

export type CoverFallback = {
  src: string;
  /** See CoverImage's own prop docs: `cover` fills the frame (a real
   *  photo), `contain` keeps a MARK from being blown up and cropped like
   *  one. */
  fit: "cover" | "contain";
  position: "center" | "top";
};

export function articleCoverFallback(
  kind: "news" | "opinion" | undefined,
  authorAvatar: string | null | undefined,
): CoverFallback {
  if (kind === "opinion" && authorAvatar) {
    return { src: authorAvatar, fit: "cover", position: "top" };
  }
  return { src: SITE_LOGO_SRC, fit: "contain", position: "center" };
}
