import type { MetadataRoute } from "next";
import { isLatinScript } from "@/lib/format";

import { getArticles, getReels, getSections, getVideos } from "@/lib/api";
import { REELS_HIDDEN, VIDEO_DESK_HIDDEN, visibleSections } from "@/lib/hiddenDesks";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

/**
 * Everything a crawler should find, one URL per real page. Only published
 * work can appear — the API already scopes anonymous reads to published,
 * and this route fetches anonymously, so a draft can't leak in here even
 * by mistake.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [ar, en, sections, videos, reels] = await Promise.all([
    getArticles("?language=ar&ordering=-published_at&page_size=500"),
    getArticles("?language=en&ordering=-published_at&page_size=500"),
    getSections(),
    getVideos("?page_size=100"),
    getReels(100),
  ]);


  // A hidden desk is absent from the sitemap entirely — see
  // lib/hiddenDesks.ts. Listing a URL that answers 404 is the one thing a
  // sitemap must never do.
  const staticPages: MetadataRoute.Sitemap = [
    ...(VIDEO_DESK_HIDDEN
      ? []
      : [{ url: `${SITE_URL}/video`, changeFrequency: "daily" as const, priority: 0.7 }]),
    { url: `${SITE_URL}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/en`, changeFrequency: "hourly", priority: 0.9 },
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

  const sectionPages: MetadataRoute.Sitemap = visibleSections(sections.results).flatMap((s) => [
    { url: `${SITE_URL}/section/${s.key}`, changeFrequency: "hourly" as const, priority: 0.7 },
    { url: `${SITE_URL}/en/section/${s.key}`, changeFrequency: "hourly" as const, priority: 0.6 },
  ]);

  const videoPages: MetadataRoute.Sitemap = (VIDEO_DESK_HIDDEN ? [] : videos.results).map((v) => ({
    url: `${SITE_URL}${isLatinScript(v.title) ? "/en/video" : "/video"}/${encodeURIComponent(v.slug)}`,
    lastModified: v.created_at,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // Same reasoning as videoPages above: Reel carries no language field
  // either, so this picks ONE canonical URL per reel by script rather than
  // listing both /reel/<slug> and /en/reel/<slug> — both render the exact
  // same reel, and indexing it twice would just split its own SEO signal
  // against itself. 0.5, a shade below video: a reel is a Facebook embed
  // with three fields of first-party content, not a hosted, described video.
  const reelPages: MetadataRoute.Sitemap = (REELS_HIDDEN ? [] : reels.results).map((r) => ({
    url: `${SITE_URL}${isLatinScript(r.title) ? "/en/reel" : "/reel"}/${encodeURIComponent(r.slug)}`,
    lastModified: r.created_at,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticPages, ...sectionPages, ...articles, ...videoPages, ...reelPages];
}
