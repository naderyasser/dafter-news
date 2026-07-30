import type { Metadata } from "next";

import { mediaUrl } from "@/lib/api";
import { stripInline } from "@/lib/richtext";
import type { ArticleDetail } from "@/lib/types";

/**
 * The one place the public origin is written down. Everything SEO-shaped —
 * canonicals, the sitemap, RSS links, OG URLs — reads this, so moving to the
 * real production domain is one env var (NEXT_PUBLIC_SITE_URL), not a grep.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://dafter.educore.software").replace(/\/$/, "");

export const SITE_NAME = { ar: "الدفتر نيوز", en: "Al Daftar News" } as const;

/** JSON that cannot close a <script> tag, whatever the data contains. */
export function jsonForScriptTag(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** First ~160 chars of real prose for a snippet: standfirst if the desk
 *  wrote one, else the opening paragraph, colour tokens stripped. */
export function articleDescription(article: ArticleDetail): string {
  const source =
    article.standfirst || article.blocks.find((b) => b.type === "paragraph" && b.text)?.text || "";
  const plain = stripInline(source).replace(/\s+/g, " ").trim();
  return plain.length > 160 ? `${plain.slice(0, 157)}…` : plain;
}

/**
 * Metadata for an article/opinion page in either edition.
 *
 * This ALSO carries the soft-404 fix in its shape: callers run their
 * existence check inside generateMetadata — which executes before the
 * response starts — so notFound() thrown there yields a real 404 status.
 * Thrown only from the page body, it lands mid-stream on routes with a
 * loading.tsx boundary, after the 200 has already gone out; the body
 * said «غير موجود» while the status told crawlers to index it.
 */
export function articleMetadata(article: ArticleDetail, path: string): Metadata {
  const lang = article.language === "en" ? "en" : "ar";
  const description = articleDescription(article);
  const cover = mediaUrl(article.cover_image);
  const url = `${SITE_URL}${path}`;

  return {
    title: article.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: article.title,
      description,
      url,
      siteName: SITE_NAME[lang],
      locale: lang === "ar" ? "ar_EG" : "en_US",
      publishedTime: article.published_at ?? undefined,
      modifiedTime: article.created_at,
      authors: article.author?.name ? [article.author.name] : undefined,
      images: cover ? [{ url: cover, width: 1600, height: 900, alt: article.cover_caption || article.title }] : undefined,
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title: article.title,
      description,
      images: cover ? [cover] : undefined,
    },
  };
}

/**
 * NewsArticle structured data — what Google News / Discover actually read.
 *
 * The one dangerouslySetInnerHTML in the public codebase, so its output is
 * made incapable of carrying markup: JSON.stringify escapes quotes but NOT
 * `<`, and a headline containing `</script>` would otherwise terminate the
 * tag mid-JSON — the classic JSON-LD escape. Every `<` leaves here as
 * <, which is identical JSON and inert HTML.
 */
export function articleJsonLd(article: ArticleDetail, path: string): string {
  const cover = mediaUrl(article.cover_image);
  return jsonForScriptTag({
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}${path}` },
    headline: article.title,
    description: articleDescription(article),
    image: cover ? [cover] : undefined,
    datePublished: article.published_at ?? undefined,
    dateModified: article.created_at,
    inLanguage: article.language === "en" ? "en" : "ar",
    author: article.author?.name
      ? [{ "@type": "Person", name: article.author.name, url: `${SITE_URL}/authors/${article.author.username}` }]
      : undefined,
    publisher: {
      "@type": "NewsMediaOrganization",
      name: SITE_NAME[article.language === "en" ? "en" : "ar"],
      url: SITE_URL,
    },
    articleSection: article.section?.name_ar || undefined,
  });
}
