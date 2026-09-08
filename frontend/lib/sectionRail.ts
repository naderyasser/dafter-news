/**
 * Which «الأكثر قراءة» a section page shows beside its own stories.
 *
 * The client's ask (2026-09-09) was the rail newspapers like الشروق run on a
 * category page: the most-read stories OF THAT DESK. The ranking is the
 * site-wide one (trending score inside a 48-hour window — see lib/api's
 * getMostRead) scoped by section, and on a busy desk that is exactly right.
 *
 * On a quiet desk it is not. A section that filed two stories this week
 * has two "most read" stories, and a ranked list of two under a heading
 * that promises a ranking reads as broken. So below `min` desk entries the
 * page falls back to the site-wide list under the plain heading — an honest
 * list of what the paper's readers are reading, rather than a desk-scoped
 * heading over stories that were mostly borrowed from elsewhere.
 */
export function pickMostReadRail<T>(desk: T[], site: T[], { min = 3, limit = 5 }: { min?: number; limit?: number } = {}): { items: T[]; scoped: boolean } {
  if (desk.length >= min) return { items: desk.slice(0, limit), scoped: true };
  return { items: site.slice(0, limit), scoped: false };
}
