import { describe, expect, it } from "vitest";

import { articleHref } from "./routes";

/**
 * /article/[slug] 404s anything but kind === "news" (its generateMetadata
 * gates on it), and the Arabic site has no /en/opinion route — so every
 * listing that links to a story has to branch on kind and language the same
 * way this helper does, or a columnist's byline anywhere outside its own
 * section (home page rails, an author's page, "اقرأ أيضاً" boxes, tag pages…)
 * turns into a dead link.
 */
describe("articleHref", () => {
  it("routes an Arabic news article to /article/[slug]", () => {
    expect(articleHref({ kind: "news", slug: "story-1" })).toBe("/article/story-1");
  });

  it("routes an Arabic opinion piece to /opinion/[slug]", () => {
    expect(articleHref({ kind: "opinion", slug: "column-1" })).toBe("/opinion/column-1");
  });

  it("defaults to the Arabic edition when lang is omitted", () => {
    expect(articleHref({ kind: "opinion", slug: "column-1" })).toBe(articleHref({ kind: "opinion", slug: "column-1" }, "ar"));
  });

  it("routes every English article to /en/article/[slug], opinion included", () => {
    expect(articleHref({ kind: "news", slug: "story-1" }, "en")).toBe("/en/article/story-1");
    expect(articleHref({ kind: "opinion", slug: "column-1" }, "en")).toBe("/en/article/column-1");
  });
});
