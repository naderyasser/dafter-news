import { describe, expect, it } from "vitest";

import { pickLatest } from "./homeFeed";

const story = (id: number) => ({ id, title: `خبر ${id}` });
const recent = [1, 2, 3, 4, 5, 6, 7, 8].map(story);

/**
 * «أحدث الأخبار» rendered an empty box under its own heading in production.
 * The cause was upstream of the component: the home page filtered this list
 * against every story any block had already shown, and once the section
 * blocks started recording their own stories that set covered nearly all of
 * `recent`.
 *
 * The invariant these pin is simple and is the one that was violated: given
 * stories, this returns stories.
 */
describe("pickLatest", () => {
  it("never returns empty while the input has stories — the reported bug", () => {
    // The worst case: every recent story is already on screen further up.
    const everything = new Set(recent.map((s) => s.id));

    const picked = pickLatest(recent, everything, 6);

    expect(picked).toHaveLength(6);
  });

  it("prefers stories the reader has not just scrolled past", () => {
    const top = new Set([1, 2, 3]);

    const picked = pickLatest(recent, top, 3);

    expect(picked.map((s) => s.id)).toEqual([4, 5, 6]);
  });

  it("tops up from the top-of-page stories when there are too few fresh ones", () => {
    const top = new Set([1, 2, 3, 4, 5, 6]);

    const picked = pickLatest(recent, top, 4);

    // 7 and 8 are fresh; the remaining two slots fall back rather than
    // shrinking the list.
    expect(picked.map((s) => s.id)).toEqual([7, 8, 1, 2]);
  });

  it("keeps newest-first order inside each group", () => {
    const picked = pickLatest(recent, new Set([1]), 8);

    expect(picked.map((s) => s.id)).toEqual([2, 3, 4, 5, 6, 7, 8, 1]);
  });

  it("returns everything it has when asked for more than exists", () => {
    const picked = pickLatest(recent.slice(0, 3), new Set(), 6);

    expect(picked).toHaveLength(3);
  });

  it("handles an empty feed without throwing", () => {
    expect(pickLatest([], new Set([1]), 6)).toEqual([]);
  });

  it("returns nothing when asked for nothing", () => {
    expect(pickLatest(recent, new Set(), 0)).toEqual([]);
  });

  it("never repeats a story within the returned list", () => {
    const picked = pickLatest(recent, new Set([1, 2]), 8);

    expect(new Set(picked.map((s) => s.id)).size).toBe(picked.length);
  });
});
