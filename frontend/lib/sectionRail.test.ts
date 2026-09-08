import { describe, expect, it } from "vitest";

import { pickMostReadRail } from "./sectionRail";

describe("pickMostReadRail", () => {
  const ids = (n: number, prefix = "d") => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

  it("shows the desk's own ranking when the desk has enough read stories", () => {
    const rail = pickMostReadRail(ids(5), ids(5, "s"));
    expect(rail.scoped).toBe(true);
    expect(rail.items).toEqual(["d0", "d1", "d2", "d3", "d4"]);
  });

  it("caps the desk list at the rail's length", () => {
    expect(pickMostReadRail(ids(8), ids(5, "s")).items).toHaveLength(5);
  });

  it("falls back to the site-wide list, unscoped, on a quiet desk rather than ranking two stories", () => {
    const rail = pickMostReadRail(ids(2), ids(5, "s"));
    expect(rail.scoped).toBe(false);
    expect(rail.items).toEqual(["s0", "s1", "s2", "s3", "s4"]);
  });

  it("takes exactly `min` desk stories as enough", () => {
    expect(pickMostReadRail(ids(3), ids(5, "s")).scoped).toBe(true);
  });

  it("returns an empty rail when neither list has anything — the page then renders no block", () => {
    expect(pickMostReadRail([], []).items).toEqual([]);
  });
});
