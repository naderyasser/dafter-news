import { getArticles, mediaUrl } from "@/lib/api";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { stripInline } from "@/lib/richtext";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * RSS 2.0 for one edition — what aggregators, reader apps and half the
 * region's news portals actually poll. Built by hand because the feed is
 * thirty <item>s of escaped text; a dependency would be larger than the
 * output.
 */
export async function buildFeed(lang: "ar" | "en"): Promise<string> {
  const list = await getArticles(`?language=${lang}&ordering=-published_at&page_size=30`);
  const isAr = lang === "ar";
  const home = isAr ? SITE_URL : `${SITE_URL}/en`;
  const self = `${home === SITE_URL ? SITE_URL : home}/rss.xml`;

  const items = list.results
    .map((a) => {
      const path = a.kind === "opinion" ? "/opinion" : isAr ? "/article" : "/en/article";
      const url = `${SITE_URL}${path}/${encodeURIComponent(a.slug)}`;
      const cover = mediaUrl(a.cover_image);
      return [
        "    <item>",
        `      <title>${esc(a.title)}</title>`,
        `      <link>${esc(url)}</link>`,
        `      <guid isPermaLink="true">${esc(url)}</guid>`,
        a.published_at ? `      <pubDate>${new Date(a.published_at).toUTCString()}</pubDate>` : "",
        a.section_name ? `      <category>${esc(a.section_name)}</category>` : "",
        a.author_name ? `      <dc:creator>${esc(a.author_name)}</dc:creator>` : "",
        cover ? `      <enclosure url="${esc(cover)}" type="image/jpeg"/>` : "",
        `      <description>${esc(stripInline(a.subcategory || a.section_name || ""))}</description>`,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(SITE_NAME[lang])}</title>
    <link>${esc(home)}</link>
    <atom:link href="${esc(self)}" rel="self" type="application/rss+xml"/>
    <description>${
      isAr
        ? "موقع إخباري عربي يغطي مصر والمنطقة: سياسة، اقتصاد، رياضة، ورأي."
        : "Arabic news from Egypt and the region: politics, economy, sport and opinion."
    }</description>
    <language>${isAr ? "ar" : "en"}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
}
