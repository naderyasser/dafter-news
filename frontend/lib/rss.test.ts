import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_ORIGIN } from "./api";
import { articleUrl, buildFeed, itemDescription } from "./rss";
import { SITE_URL } from "./seo";
import type { ArticleCard } from "./types";

const card = (over: Partial<ArticleCard> = {}): ArticleCard =>
  ({
    id: 1,
    title: "البنك المركزي يثبّت أسعار الفائدة",
    slug: "central-bank-holds",
    href_slug: "central-bank-holds",
    section_name: "حركة السوق",
    subcategory: "",
    country: "",
    badge: "none",
    status: "published",
    cover_image: "/media/covers/central-bank.jpg",
    cover_image_width: 1216,
    cover_image_height: 802,
    published_at: "2026-07-28T09:00:00Z",
    views: 10,
    kind: "news",
    comment_count: 0,
    author_name: "محمد العدوي",
    author_name_en: "Mohamed Eladawy",
    author_username: "m.eladawy",
    author_initial: "م",
    author_avatar: null,
    standfirst: "قرار الفائدة جاء متوافقاً مع توقعات السوق.",
    excerpt: "قرار الفائدة جاء متوافقاً مع توقعات السوق.",
    ...over,
  }) as ArticleCard;

/** The feed makes exactly two API reads — the article page and the site
 *  settings (for the channel logo). Route on the path so a test can vary
 *  either independently. */
function stubApi(articles: ArticleCard[], settings: unknown = { logo: "/media/branding/logo.png" }) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            String(url).includes("/settings/")
              ? settings
              : { count: articles.length, next: null, previous: null, results: articles },
          ),
      } as Response),
    ),
  );
}

describe("itemDescription", () => {
  it("uses the API's summary of the story", () => {
    expect(itemDescription(card())).toBe("قرار الفائدة جاء متوافقاً مع توقعات السوق.");
  });

  it("summarises from the opening paragraph when the desk filed no standfirst", () => {
    // What get_excerpt returns in that case — the common case on this site.
    expect(itemDescription(card({ standfirst: "", excerpt: "افتُتح المحور صباح اليوم." }))).toBe(
      "افتُتح المحور صباح اليوم.",
    );
  });

  it("strips the editor's inline colour/format tokens", () => {
    expect(itemDescription(card({ excerpt: "{b|الرئيس} يفتتح المحور" }))).toBe("الرئيس يفتتح المحور");
  });

  it("falls back to the label only when the story has no prose at all", () => {
    expect(itemDescription(card({ standfirst: "", excerpt: "", subcategory: "سياسة" }))).toBe("سياسة");
    expect(itemDescription(card({ standfirst: "", excerpt: "", subcategory: "" }))).toBe("حركة السوق");
  });

  it("truncates a long summary rather than shipping the whole body", () => {
    const out = itemDescription(card({ excerpt: "ا".repeat(400) }));
    expect(out).toHaveLength(298);
    expect(out.endsWith("…")).toBe(true);
  });

  it("counts visible characters, not markup — tokens are stripped before the cut", () => {
    const out = itemDescription(card({ excerpt: `{b|${"ا".repeat(200)}} ${"ب".repeat(50)}` }));
    expect(out).toBe(`${"ا".repeat(200)} ${"ب".repeat(50)}`);
    expect(out).not.toContain("{");
  });
});

describe("articleUrl", () => {
  it("routes Arabic opinion to /opinion and news to /article", () => {
    expect(articleUrl(card({ kind: "opinion" }), "ar")).toBe(`${SITE_URL}/opinion/central-bank-holds`);
    expect(articleUrl(card(), "ar")).toBe(`${SITE_URL}/article/central-bank-holds`);
  });

  it("keeps an English column inside the English edition — there is no /en/opinion", () => {
    expect(articleUrl(card({ kind: "opinion" }), "en")).toBe(`${SITE_URL}/en/article/central-bank-holds`);
  });

  it("percent-encodes an Arabic slug", () => {
    expect(articleUrl(card({ slug: "الرئيس" }), "ar")).toBe(`${SITE_URL}/article/${encodeURIComponent("الرئيس")}`);
  });
});

describe("buildFeed", () => {
  beforeEach(() => stubApi([card()]));
  afterEach(() => vi.unstubAllGlobals());

  it("declares the Media RSS namespace Google News reads images from", async () => {
    expect(await buildFeed("ar")).toContain('xmlns:media="http://search.yahoo.com/mrss/"');
  });

  it("carries the channel metadata a feed reader needs", async () => {
    const xml = await buildFeed("ar");
    expect(xml).toContain("<title>الدفتر</title>");
    expect(xml).toContain(`<link>${SITE_URL}</link>`);
    expect(xml).toContain("<language>ar</language>");
    expect(xml).toContain(`<atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>`);
  });

  it("points the English edition's self link and home at /en", async () => {
    const xml = await buildFeed("en");
    expect(xml).toContain(`<link>${SITE_URL}/en</link>`);
    expect(xml).toContain(`<atom:link href="${SITE_URL}/en/rss.xml"`);
    expect(xml).toContain("<language>en</language>");
  });

  it("gives every item the cover photo in both vocabularies", async () => {
    const xml = await buildFeed("ar");
    const cover = `${API_ORIGIN}/media/covers/central-bank.jpg`;
    expect(xml).toContain(`<enclosure url="${cover}" type="image/jpeg" length="0"/>`);
    expect(xml).toContain(`<media:content url="${cover}" type="image/jpeg" medium="image" width="1216" height="802">`);
    expect(xml).toContain(`<media:thumbnail url="${cover}" width="1216" height="802"/>`);
  });

  it("names the cover's real format, not always jpeg", async () => {
    stubApi([card({ cover_image: "/media/covers/a.png" })]);
    expect(await buildFeed("ar")).toContain('type="image/png"');
  });

  it("omits dimensions for a cover uploaded before they were recorded", async () => {
    stubApi([card({ cover_image_width: null, cover_image_height: null })]);
    const xml = await buildFeed("ar");
    expect(xml).toContain('<media:thumbnail url="');
    expect(xml).not.toContain("width=");
  });

  it("emits no image tags at all for an article with no cover", async () => {
    stubApi([card({ cover_image: null })]);
    const xml = await buildFeed("ar");
    expect(xml).not.toContain("<enclosure");
    expect(xml).not.toContain("<media:");
  });

  it("dates each item in RFC 822", async () => {
    expect(await buildFeed("ar")).toContain("<pubDate>Tue, 28 Jul 2026 09:00:00 GMT</pubDate>");
  });

  it("drops an item that has no publish date rather than emitting it dateless", async () => {
    stubApi([card({ published_at: null })]);
    const xml = await buildFeed("ar");
    expect(xml).not.toContain("<item>");
  });

  it("bylines each edition in its own language", async () => {
    expect(await buildFeed("ar")).toContain("<dc:creator>محمد العدوي</dc:creator>");
    expect(await buildFeed("en")).toContain("<dc:creator>Mohamed Eladawy</dc:creator>");
  });

  it("escapes markup in a headline instead of breaking the document", async () => {
    stubApi([card({ title: 'مصر & "الخليج" <عاجل>' })]);
    const xml = await buildFeed("ar");
    expect(xml).toContain("<title>مصر &amp; &quot;الخليج&quot; &lt;عاجل&gt;</title>");
  });

  it("carries the publication logo, and skips <image> when none is set", async () => {
    expect(await buildFeed("ar")).toContain(`<url>${API_ORIGIN}/media/branding/logo.png</url>`);
    stubApi([card()], { logo: null });
    expect(await buildFeed("ar")).not.toContain("<image>");
  });

  it("uses the guid as a permalink so readers dedupe across rebuilds", async () => {
    expect(await buildFeed("ar")).toContain(
      `<guid isPermaLink="true">${SITE_URL}/article/central-bank-holds</guid>`,
    );
  });
});
