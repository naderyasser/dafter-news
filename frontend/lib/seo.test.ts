import { describe, expect, it } from "vitest";

import {
  articleDescription,
  articleJsonLd,
  articleMetadata,
  jsonForScriptTag,
  sectionMetadata,
  sectionsItemListJsonLd,
  siteJsonLd,
} from "./seo";
import type { ArticleDetail, Section } from "./types";

const article = (over: Partial<ArticleDetail> = {}): ArticleDetail =>
  ({
    id: 1,
    title: "البنك المركزي يثبّت أسعار الفائدة",
    slug: "central-bank-holds",
    kind: "news",
    section: { id: 1, key: "economy", name_ar: "حركة السوق", name_en: "Markets", order: 4 },
    subcategory: "",
    author: { username: "m.eladawy", name: "محمد العدوي", name_en: "", initial: "م", title: "", bio: "", avatar: null, article_count: 0 },
    tags: [],
    language: "ar",
    related_article: null,
    status: "published",
    badge: "none",
    pinned: false,
    standfirst: "قرار الفائدة جاء متوافقاً مع توقعات السوق.",
    cover_image: "/media/covers/central-bank.jpg",
    cover_image_width: null,
    cover_image_height: null,
    cover_caption: "",
    cover_credit: "",
    views: 10,
    read_minutes: 3,
    tts_status: "idle",
    tts_audio: null,
    tts_duration_seconds: 0,
    published_at: "2026-07-28T09:00:00Z",
    scheduled_for: null,
    created_at: "2026-07-27T08:00:00Z",
    blocks: [],
    comments: [],
    ...over,
  }) as ArticleDetail;

describe("jsonForScriptTag", () => {
  it("makes </script> incapable of closing the tag", () => {
    const out = jsonForScriptTag({ title: 'قبل</script><script>alert("x")</script>' });

    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c/script");
    // Still exactly the same data after parsing.
    expect(JSON.parse(out).title).toBe('قبل</script><script>alert("x")</script>');
  });
});

describe("articleDescription", () => {
  it("prefers the standfirst", () => {
    expect(articleDescription(article())).toBe("قرار الفائدة جاء متوافقاً مع توقعات السوق.");
  });

  it("falls back to the first paragraph with colour tokens stripped", () => {
    const a = article({
      standfirst: "",
      blocks: [
        { id: 1, type: "heading", text: "عنوان فرعي", image: null, image_name: "", caption: "", credit: "", order: 0 },
        { id: 2, type: "paragraph", text: "الفقرة {c:#B01F2E|الملوّنة} الأولى.", image: null, image_name: "", caption: "", credit: "", order: 1 },
      ] as ArticleDetail["blocks"],
    });

    expect(articleDescription(a)).toBe("الفقرة الملوّنة الأولى.");
  });

  it("cuts at ~160 chars without splitting the ellipsis rule", () => {
    const long = article({ standfirst: "كلمة ".repeat(80) });

    const d = articleDescription(long);
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d.endsWith("…")).toBe(true);
  });
});

describe("articleMetadata", () => {
  it("carries title, canonical, OG article and the cover", () => {
    const m = articleMetadata(article(), "/article/central-bank-holds");

    expect(m.title).toBe("البنك المركزي يثبّت أسعار الفائدة");
    expect(String(m.alternates?.canonical)).toContain("/article/central-bank-holds");
    const og = m.openGraph as Record<string, unknown>;
    expect(og.locale).toBe("ar_EG");
    expect(og.publishedTime).toBe("2026-07-28T09:00:00Z");
    expect((m.twitter as Record<string, unknown>).card).toBe("summary_large_image");
  });

  it("degrades to a text card for a NEWS story with no cover", () => {
    // A news report's identity is the report, not whoever filed it — its
    // author's face is deliberately not offered as the preview. See the
    // opinion block below for the case that is.
    const m = articleMetadata(article({ cover_image: null }), "/article/x");

    expect((m.twitter as Record<string, unknown>).card).toBe("summary");
    expect((m.openGraph as Record<string, unknown>).images).toBeUndefined();
  });

  /**
   * The newsroom's ask, and the same editorial line lib/coverFallback.ts
   * already follows for the cards themselves: an opinion piece filed without
   * a cover is previewed with its columnist's own portrait.
   */
  describe("opinion pieces with no cover", () => {
    const columnist = (over: Partial<ArticleDetail> = {}) =>
      article({
        kind: "opinion",
        cover_image: null,
        slug: "a-column",
        author: {
          username: "a.nasry",
          name: "عبدالرحمن الناصري",
          name_en: "",
          initial: "ع",
          title: "",
          bio: "",
          avatar: "/media/avatars/writer.jpg",
          article_count: 0,
        },
        ...over,
      });

    it("previews with the composed author card, at its exact rendered size", () => {
      const m = articleMetadata(columnist(), "/opinion/a-column");

      const [img] = (m.openGraph as Record<string, unknown>).images as Record<string, unknown>[];
      expect(String(img.url)).toBe("https://aldaftarnews.com/og/article/a-column");
      // The route renders exactly 1200×630 every time, so unlike the cover
      // branch these are facts rather than a fallback guess.
      expect(img.width).toBe(1200);
      expect(img.height).toBe(630);
      expect(img.type).toBe("image/png");
    });

    it("asks for the wide card, not the small square one", () => {
      const m = articleMetadata(columnist(), "/opinion/a-column");
      const twitter = m.twitter as Record<string, unknown>;

      expect(twitter.card).toBe("summary_large_image");
      expect(twitter.images).toEqual(["https://aldaftarnews.com/og/article/a-column"]);
    });

    it("gives the og:image an absolute URL, which is the only kind a crawler accepts", () => {
      const m = articleMetadata(columnist(), "/opinion/a-column");

      const [img] = (m.openGraph as Record<string, unknown>).images as Record<string, unknown>[];
      expect(String(img.url).startsWith("https://")).toBe(true);
      expect(String(img.secureUrl).startsWith("https://")).toBe(true);
    });

    it("prefers a real cover photo over the author card when the piece has one", () => {
      const m = articleMetadata(columnist({ cover_image: "/media/covers/real.jpg" }), "/opinion/a-column");

      const [img] = (m.openGraph as Record<string, unknown>).images as Record<string, unknown>[];
      expect(String(img.url)).toContain("/media/covers/real.jpg");
    });

    it("degrades to a text card for a columnist with no portrait on file", () => {
      const m = articleMetadata(columnist({ author: { ...columnist().author!, avatar: null } }), "/opinion/a-column");

      expect((m.twitter as Record<string, unknown>).card).toBe("summary");
      expect((m.openGraph as Record<string, unknown>).images).toBeUndefined();
    });
  });

  /**
   * The newsroom's report was that shared links carry `?fbclid=…` tracking
   * strings. Those are appended by Facebook on the outbound click, not by
   * anything here — the defence is that both the canonical and og:url state
   * the clean address, so a crawler that follows a decorated link still
   * files it under the undecorated one.
   */
  it("states one clean absolute URL as both canonical and og:url", () => {
    const m = articleMetadata(article(), "/article/central-bank-holds");

    const canonical = String(m.alternates?.canonical);
    expect(canonical).toBe("https://aldaftarnews.com/article/central-bank-holds");
    expect(canonical).not.toContain("?");
    expect((m.openGraph as Record<string, unknown>).url).toBe(canonical);
  });

  /**
   * Regression: og:image:width/height were hardcoded to 1600x900 regardless
   * of the actual file — most covers on this site are nowhere near that
   * (a phone photo at, say, 1216x802). A declared size that doesn't match
   * the real file is a documented reason Facebook's/WhatsApp's crawler
   * drops the image from a link preview outright.
   */
  it("declares the image's real dimensions, not a hardcoded guess", () => {
    const m = articleMetadata(article({ cover_image_width: 1216, cover_image_height: 802 }), "/article/x");

    const [img] = (m.openGraph as Record<string, unknown>).images as Record<string, unknown>[];
    expect(img.width).toBe(1216);
    expect(img.height).toBe(802);
  });

  it("falls back to 1600x900 for an article saved before dimensions were tracked", () => {
    const m = articleMetadata(article({ cover_image_width: null, cover_image_height: null }), "/article/x");

    const [img] = (m.openGraph as Record<string, unknown>).images as Record<string, unknown>[];
    expect(img.width).toBe(1600);
    expect(img.height).toBe(900);
  });

  it("sends secure_url and the real image type Meta's crawler docs ask for", () => {
    const m = articleMetadata(article({ cover_image: "/media/covers/x.png" }), "/article/x");

    const [img] = (m.openGraph as Record<string, unknown>).images as Record<string, unknown>[];
    expect(img.secureUrl).toContain("/media/covers/x.png");
    expect(img.type).toBe("image/png");
  });
});

describe("articleJsonLd", () => {
  it("emits parseable NewsArticle with author and publisher", () => {
    const parsed = JSON.parse(articleJsonLd(article(), "/article/central-bank-holds"));

    expect(parsed["@type"]).toBe("NewsArticle");
    expect(parsed.headline).toBe("البنك المركزي يثبّت أسعار الفائدة");
    expect(parsed.author[0].name).toBe("محمد العدوي");
    expect(parsed.publisher["@type"]).toBe("NewsMediaOrganization");
    expect(parsed.inLanguage).toBe("ar");
  });

  it("survives a hostile headline without producing a closable tag", () => {
    const out = articleJsonLd(article({ title: "</script><script>alert(1)</script>" }), "/article/x");

    expect(out).not.toContain("</script>");
    expect(JSON.parse(out).headline).toBe("</script><script>alert(1)</script>");
  });
});

describe("siteJsonLd", () => {
  const graph = (opts?: { logo?: string; sameAs?: string[] }) => {
    const nodes = JSON.parse(siteJsonLd(opts))["@graph"] as Record<string, any>[];
    return {
      website: nodes.find((n) => n["@type"] === "WebSite")!,
      org: nodes.find((n) => n["@type"] === "NewsMediaOrganization")!,
    };
  };

  it("names the site «الدفتر» — what gets Google to show the brand instead of the raw domain", () => {
    const { website } = graph();

    expect(website.name).toBe("الدفتر");
    expect(website.url).toBe("https://aldaftarnews.com");
  });

  it("claims every name the newsroom is searched by, in both scripts", () => {
    // The site has traded under the longer Arabic name and has no settled
    // romanisation; all of them have to resolve to this one entity.
    const { website, org } = graph();

    expect(website.alternateName).toEqual(["Aldaftar", "الدفتر نيوز", "Aldaftar News"]);
    expect(org.alternateName).toEqual(website.alternateName);
  });

  it("ties the site to its publisher, and the publisher to every article", () => {
    // One @id shared by the organisation node here and articleJsonLd's
    // publisher — otherwise they are two objects that merely share a name.
    const { website, org } = graph();
    const articleLd = JSON.parse(articleJsonLd(article(), "/article/x"));

    expect(org["@id"]).toBe("https://aldaftarnews.com/#organization");
    expect(website.publisher).toEqual({ "@id": org["@id"] });
    expect(articleLd.publisher["@id"]).toBe(org["@id"]);
    expect(articleLd.publisher.name).toBe("الدفتر");
  });

  it("carries the newsroom's own logo and profiles when it has them", () => {
    const { org } = graph({
      logo: "https://aldaftarnews.com/media/branding/logo.png",
      sameAs: ["https://facebook.com/aldaftar"],
    });

    expect(org.logo).toEqual({ "@type": "ImageObject", url: "https://aldaftarnews.com/media/branding/logo.png" });
    expect(org.sameAs).toEqual(["https://facebook.com/aldaftar"]);
  });

  it("omits logo and sameAs rather than emitting empty ones", () => {
    const { org } = graph();

    expect(org).not.toHaveProperty("logo");
    expect(org).not.toHaveProperty("sameAs");
  });
});

describe("sectionsItemListJsonLd", () => {
  const sections = [
    { id: 1, key: "pol", name_ar: "سياسة", name_en: "Politics", order: 0, article_count: 0, cover_image: null, tagline: "" },
    { id: 2, key: "sports", name_ar: "رياضة", name_en: "Sports", order: 1, article_count: 0, cover_image: null, tagline: "" },
  ] as Section[];

  it("lists every section as a positioned, linked ListItem", () => {
    const parsed = JSON.parse(sectionsItemListJsonLd(sections));

    expect(parsed["@type"]).toBe("ItemList");
    expect(parsed.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "سياسة", url: "https://aldaftarnews.com/section/pol" },
      { "@type": "ListItem", position: 2, name: "رياضة", url: "https://aldaftarnews.com/section/sports" },
    ]);
  });
});

describe("sectionMetadata", () => {
  const section = { id: 1, key: "pol", name_ar: "سياسة", name_en: "Politics", order: 0, article_count: 0, cover_image: null, tagline: "" } as Section;

  it("gives the Arabic front its own distinct title and canonical — not the homepage's", () => {
    const m = sectionMetadata(section, "ar");

    expect(m.title).toBe("سياسة");
    expect(String(m.alternates?.canonical)).toBe("https://aldaftarnews.com/section/pol");
  });

  it("gives the English front its own English name and /en canonical", () => {
    const m = sectionMetadata(section, "en");

    expect(m.title).toBe("Politics");
    expect(String(m.alternates?.canonical)).toBe("https://aldaftarnews.com/en/section/pol");
  });

  it("falls back to the Arabic name when a section has no English one yet", () => {
    const m = sectionMetadata({ ...section, name_en: "" }, "en");

    expect(m.title).toBe("سياسة");
  });
});
