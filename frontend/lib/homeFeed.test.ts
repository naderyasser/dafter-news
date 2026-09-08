import { describe, expect, it } from "vitest";

import { pickLatest } from "./homeFeed";

const story = (id: number) => ({ id, title: `خبر ${id}` });
const recent = [1, 2, 3, 4, 5, 6, 7, 8].map(story);

/**
 * «أحدث الأخبار» has been wrong twice in production, in opposite directions:
 * an empty box (filtered against everything on the page), then the newest
 * story at the BOTTOM (stories shown in the hero were pushed to the end).
 *
 * The invariant these pin is the one the heading makes: the API's order,
 * untouched, newest first.
 */
describe("pickLatest", () => {
  it("keeps the API's newest-first order exactly — the reported bug was reordering it", () => {
    const picked = pickLatest(recent, 6);

    expect(picked.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("puts the newest story first even though the hero shows it too", () => {
    // The hero takes the newest stories; that must never demote them here.
    const picked = pickLatest(recent, 3);

    expect(picked[0].id).toBe(1);
  });

  it("returns everything it has when asked for more than exists", () => {
    const picked = pickLatest(recent.slice(0, 3), 6);

    expect(picked).toHaveLength(3);
  });

  it("handles an empty feed without throwing", () => {
    expect(pickLatest([], 6)).toEqual([]);
  });

  it("returns nothing when asked for nothing", () => {
    expect(pickLatest(recent, 0)).toEqual([]);
  });

  it("never repeats a story within the returned list", () => {
    const picked = pickLatest([...recent, story(1), story(2)], 10);

    expect(new Set(picked.map((s) => s.id)).size).toBe(picked.length);
    expect(picked).toHaveLength(8);
  });
});
