import { describe, expect, it } from "vitest";

import { articleDescription, articleJsonLd, articleMetadata, jsonForScriptTag } from "./seo";
import type { ArticleDetail } from "./types";

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

  it("degrades to a text card when there is no cover", () => {
    const m = articleMetadata(article({ cover_image: null }), "/article/x");

    expect((m.twitter as Record<string, unknown>).card).toBe("summary");
    expect((m.openGraph as Record<string, unknown>).images).toBeUndefined();
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
