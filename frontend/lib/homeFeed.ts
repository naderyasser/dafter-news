/**
 * Picking what «أحدث الأخبار» shows.
 *
 * Small enough to look obvious, and it has been got wrong three times —
 * which is why it lives here with tests rather than inline in app/page.tsx.
 *
 * The rule is the one the heading promises and nothing more: the newest
 * stories, newest first, exactly as the API orders them (`-published_at`).
 *
 * What it must NOT do, because both were shipped and both were reported:
 *
 *  1. Filter against everything the page has already shown. Once the section
 *     blocks began recording their stories, that set covered nearly every
 *     recent story and the tab rendered an empty box under its own heading.
 *  2. Demote the stories the hero and its side rail show to the END of the
 *     list. The hero takes the newest stories on the site, so "prefer what
 *     the reader has not scrolled past" put the freshest headline — the one
 *     the newsroom had just published — at the bottom of a list labelled
 *     latest. That is the "«الدفعات الجوية تتصدى لهجمات» is at the bottom"
 *     report, and it was not a caching or timezone problem: the API answered
 *     newest-first and this function reordered it.
 *
 * Repeating a story from the top of a long page is a far smaller cost than
 * a list called "latest" that is not.
 */
export function pickLatest<T extends { id: number }>(recent: T[], count: number): T[] {
  if (count <= 0) return [];
  const seen = new Set<number>();
  const picked: T[] = [];
  for (const item of recent) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    picked.push(item);
    if (picked.length === count) break;
  }
  return picked;
}
