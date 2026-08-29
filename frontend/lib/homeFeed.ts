/**
 * Picking what «أحدث الأخبار» shows.
 *
 * Small enough to look obvious, and it has been got wrong twice — which is
 * why it lives here with tests rather than inline in app/page.tsx.
 *
 * The home page keeps a set of stories it has already put on screen. The
 * first attempt filtered this list against that whole set, which was fine
 * until the section blocks began recording what they show; the marked set
 * then covered nearly every recent story and the tab rendered an empty box
 * under its own heading.
 *
 * The rule that survives both failures: prefer stories the reader has not
 * just scrolled past at the TOP of the page, then top up from the rest, and
 * never return fewer than the input can fill. A list labelled "latest news"
 * repeating one story from the top of a long page is a far smaller cost
 * than a heading over nothing.
 */
export function pickLatest<T extends { id: number }>(
  recent: T[],
  topOfPageIds: ReadonlySet<number>,
  count: number,
): T[] {
  if (count <= 0) return [];
  const fresh: T[] = [];
  const seenAtTop: T[] = [];
  for (const item of recent) {
    (topOfPageIds.has(item.id) ? seenAtTop : fresh).push(item);
  }
  // Order is preserved within each group, so the list stays newest-first
  // among the stories that are actually new to the reader.
  return [...fresh, ...seenAtTop].slice(0, count);
}
