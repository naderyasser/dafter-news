import type { MetadataRoute } from "next";
import { isLatinScript } from "@/lib/format";

import { getArticles, getSections, getVideos } from "@/lib/api";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

/**
 * Everything a crawler should find, one URL per real page. Only published
 * work can appear — the API already scopes anonymous reads to published,
 * and this route fetches anonymously, so a draft can't leak in here even
 * by mistake.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [ar, en, sections, videos] = await Promise.all([
    getArticles("?language=ar&ordering=-published_at&page_size=500"),
    getArticles("?language=en&ordering=-published_at&page_size=500"),
    getSections(),
    getVideos("?page_size=100"),
  ]);


  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/en`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/video`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/markets`, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/most-read`, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/opinion`, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/authors`, changeFrequency: "weekly", priority: 0.4 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.3 },
  ];

  // The two lists arrive per-language, so each knows its own URL space —
  // ArticleCard itself doesn't carry a language column. Opinion pieces live
  // under /opinion in both editions.
  const entry = (slug: string, kind: string, lang: "ar" | "en", published: string | null) => ({
    url: `${SITE_URL}${kind === "opinion" ? "/opinion" : lang === "en" ? "/en/article" : "/article"}/${encodeURIComponent(slug)}`,
    lastModified: published ?? undefined,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  });

  const articles: MetadataRoute.Sitemap = [
    ...ar.results.map((a) => entry(a.slug, a.kind, "ar", a.published_at)),
    ...en.results.map((a) => entry(a.slug, a.kind, "en", a.published_at)),
  ];

  const sectionPages: MetadataRoute.Sitemap = sections.results.flatMap((s) => [
    { url: `${SITE_URL}/section/${s.key}`, changeFrequency: "hourly" as const, priority: 0.7 },
    { url: `${SITE_URL}/en/section/${s.key}`, changeFrequency: "hourly" as const, priority: 0.6 },
  ]);

  const videoPages: MetadataRoute.Sitemap = videos.results.map((v) => ({
    url: `${SITE_URL}${isLatinScript(v.title) ? "/en/video" : "/video"}/${encodeURIComponent(v.slug)}`,
    lastModified: v.created_at,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticPages, ...sectionPages, ...articles, ...videoPages];
}
