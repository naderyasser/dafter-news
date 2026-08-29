import { getArticles, getSiteSettings, mediaUrl } from "@/lib/api";
import { imageMimeType, SITE_NAME, SITE_URL } from "@/lib/seo";
import { stripInline } from "@/lib/richtext";
import type { ArticleCard } from "@/lib/types";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** How many stories each edition's feed carries. Google Publisher Center
 *  reads a feed as "what this publication just published", not as an
 *  archive — thirty is several days of output here, which is deep enough
 *  that a crawl every few hours never misses a story and shallow enough
 *  that the document stays small. */
const FEED_SIZE = 30;

/**
 * The item summary. Google News shows this under the headline and rejects
 * nothing for its absence — but an item whose description is the section
 * name ("حركة السوق") tells a reader nothing, which is what this feed did
 * before. `excerpt` is the API's own summary of the story (the desk's
 * standfirst if it wrote one, else the opening paragraph — see
 * ArticleCardSerializer.get_excerpt), and most stories here are filed with
 * no standfirst, so that second branch is what usually fills this. The
 * section/subcategory label survives only as the last resort for a story
 * with neither.
 *
 * Colour/format tokens are stripped (body text is stored in the editor's
 * inline grammar, see lib/richtext.ts) — an aggregator would otherwise
 * print "{b|الرئيس}" verbatim. Stripped BEFORE truncating, so the 300
 * characters counted here are 300 characters a reader actually sees.
 */
export function itemDescription(a: ArticleCard): string {
  const plain = stripInline(a.excerpt || a.standfirst || "").replace(/\s+/g, " ").trim();
  if (!plain) return a.subcategory || a.section_name || "";
  return plain.length > 300 ? `${plain.slice(0, 297)}…` : plain;
}

/**
 * Where an article lives in the edition the feed is for. Opinion pieces have
 * their own Arabic route; the English edition has no /en/opinion, so an
 * English column is linked at its /en/article/… URL rather than dropped into
 * the Arabic page's chrome (that route accepts any English article — see
 * app/en/article/[slug]/page.tsx — while /opinion/[slug] gates on kind, not
 * language).
 */
export function articleUrl(a: ArticleCard, lang: "ar" | "en"): string {
  const slug = encodeURIComponent(a.slug);
  if (lang === "en") return `${SITE_URL}/en/article/${slug}`;
  return a.kind === "opinion" ? `${SITE_URL}/opinion/${slug}` : `${SITE_URL}/article/${slug}`;
}

/**
 * The item's cover photo, declared three ways.
 *
 * Google's own feed documentation accepts either `<media:content>` (Media
 * RSS) or `<enclosure>` (RSS 2.0) for an item's image, and different
 * consumers read different ones — Publisher Center and most news
 * aggregators take Media RSS, plenty of older reader apps only ever look at
 * enclosure — so both are emitted rather than betting on one. They point at
 * the same file, which is what the spec expects: one image, described in the
 * vocabularies each reader knows.
 *
 * `width`/`height` come from the real file (Django stamps them at upload),
 * and are simply omitted for a cover uploaded before those columns existed
 * — an absent attribute is honest, a guessed 1600x900 is a lie a crawler can
 * check by fetching the file, and a mismatch is a documented reason for an
 * image to be dropped from a preview rather than merely cropped.
 *
 * `length="0"` on the enclosure: RSS 2.0 declares the attribute required and
 * defines it as the file's size in bytes, which we would have to HEAD every
 * cover on every rebuild to know. Zero is the long-standing convention for
 * "not computed" and is what feed validators accept in its place; the
 * alternative — omitting a required attribute — is a hard validation error.
 */
function imageTags(a: ArticleCard, cover: string): string[] {
  const type = imageMimeType(cover) ?? "image/jpeg";
  const dims =
    a.cover_image_width && a.cover_image_height
      ? ` width="${a.cover_image_width}" height="${a.cover_image_height}"`
      : "";
  return [
    `      <enclosure url="${esc(cover)}" type="${esc(type)}" length="0"/>`,
    `      <media:content url="${esc(cover)}" type="${esc(type)}" medium="image"${dims}>`,
    `        <media:title type="plain">${esc(a.title)}</media:title>`,
    "      </media:content>",
    `      <media:thumbnail url="${esc(cover)}"${dims}/>`,
  ];
}

/**
 * RSS 2.0 + Media RSS for one edition — the feed submitted to Google
 * Publisher Center, and what aggregators, reader apps and half the region's
 * news portals actually poll. Built by hand because the feed is thirty
 * <item>s of escaped text; a dependency would be larger than the output.
 *
 * Items without a `pubDate` are dropped rather than emitted dateless: a
 * news feed's whole ordering is the publish time, and an item Google can't
 * date is one it can't place. (Nothing served here should lack one — the
 * API only gives anonymous callers published articles, and Article.save()
 * stamps published_at as it publishes — so this is a floor, not a filter
 * that normally removes anything.)
 */
export async function buildFeed(lang: "ar" | "en"): Promise<string> {
  const [list, settings] = await Promise.all([
    getArticles(`?language=${lang}&ordering=-published_at&page_size=${FEED_SIZE}`),
    getSiteSettings(),
  ]);
  const isAr = lang === "ar";
  const home = isAr ? SITE_URL : `${SITE_URL}/en`;
  const self = `${home}/rss.xml`;
  const description = isAr
    ? "موقع إخباري عربي يغطي مصر والمنطقة: سياسة، اقتصاد، رياضة، ورأي."
    : "Arabic news from Egypt and the region: politics, economy, sport and opinion.";

  const items = list.results
    .filter((a) => a.published_at)
    .map((a) => {
      const url = articleUrl(a, lang);
      const cover = mediaUrl(a.cover_image);
      const author = (isAr ? a.author_name : a.author_name_en || a.author_name) || "";
      return [
        "    <item>",
        `      <title>${esc(a.title)}</title>`,
        `      <link>${esc(url)}</link>`,
        // isPermaLink="true" because the URL IS the identity here: slugs are
        // unique and never rewritten once set (Article.save derives one once),
        // so a reader that dedupes on guid keeps working across rebuilds.
        `      <guid isPermaLink="true">${esc(url)}</guid>`,
        `      <pubDate>${new Date(a.published_at as string).toUTCString()}</pubDate>`,
        a.section_name ? `      <category>${esc(a.section_name)}</category>` : "",
        author ? `      <dc:creator>${esc(author)}</dc:creator>` : "",
        `      <description>${esc(itemDescription(a))}</description>`,
        ...(cover ? imageTags(a, cover) : []),
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  // The publication's own logo, straight from the dashboard's site settings
  // rather than a path hardcoded here — an editor who uploads a new one
  // changes the feed too. Omitted entirely when none is set: <image> has
  // three required children, and a half-filled one is a validation error
  // where an absent optional element is not.
  const logo = mediaUrl(settings?.logo);
  const channelImage = logo
    ? [
        "    <image>",
        `      <url>${esc(logo)}</url>`,
        `      <title>${esc(SITE_NAME[lang])}</title>`,
        `      <link>${esc(home)}</link>`,
        "    </image>",
      ].join("\n")
    : "";

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">',
    "  <channel>",
    `    <title>${esc(SITE_NAME[lang])}</title>`,
    `    <link>${esc(home)}</link>`,
    `    <atom:link href="${esc(self)}" rel="self" type="application/rss+xml"/>`,
    `    <description>${esc(description)}</description>`,
    `    <language>${isAr ? "ar" : "en"}</language>`,
    `    <copyright>${esc(SITE_NAME[lang])}</copyright>`,
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    // Minutes between polls, advisory. Matches the route's own revalidate
    // window, so a well-behaved aggregator asks at roughly the rate the
    // document actually changes.
    "    <ttl>5</ttl>",
    channelImage,
    items,
    "  </channel>",
    "</rss>",
  ]
    .filter(Boolean)
    .join("\n");
}
