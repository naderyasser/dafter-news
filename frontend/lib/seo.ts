import type { Metadata } from "next";

import { mediaUrl } from "@/lib/api";
import { stripInline } from "@/lib/richtext";
import type { ArticleDetail, Section } from "@/lib/types";

/**
 * The one place the public origin is written down. Everything SEO-shaped —
 * canonicals, the sitemap, RSS links, OG URLs — reads this, so moving to the
 * real production domain is one env var (NEXT_PUBLIC_SITE_URL), not a grep.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://aldaftarnews.com").replace(/\/$/, "");

/**
 * The brand as Google should print it. «الدفتر» rather than «الدفتر نيوز»
 * on the client's instruction: the short form is the masthead, and it is
 * what a result should carry above the URL.
 *
 * The English edition keeps its full name — it is a different edition, not
 * a second spelling of this one, and its RSS feed is already filed under
 * that name. Every other form the newsroom is searched by lives in
 * SITE_ALTERNATE_NAMES below, which is what keeps «الدفتر نيوز» and the
 * romanisations resolving to this same site.
 */
export const SITE_NAME = { ar: "الدفتر", en: "Al Daftar News" } as const;

/**
 * The other names this newsroom is searched by. Google matches a query
 * against these as well as `name`, so someone typing "Aldaftar", "الدفتر
 * نيوز" or "Aldaftar News" lands on the same entity — which matters here
 * because the site has traded under the longer Arabic name and has no
 * settled romanisation.
 */
export const SITE_ALTERNATE_NAMES = ["Aldaftar", "الدفتر نيوز", "Aldaftar News"] as const;

/** The site-wide meta description — the fallback snippet for any page that
 *  doesn't describe itself (the homepage, chiefly). */
export const SITE_DESCRIPTION = {
  ar: "الدفتر بوابة إخبارية شاملة تغطي أحدث أخبار مصر، العالم، السياسة، الاقتصاد، الرياضة، والثقافة لحظة بلحظة.",
  en: "Al Daftar is a comprehensive news portal covering Egypt and the world — politics, economy, sport and culture, as it happens.",
} as const;

/**
 * One stable URI for the publisher, referenced from both the site-wide
 * Organization node and every article's `publisher`. Without it those are
 * two unrelated objects that merely share a name, and a crawler has no
 * instruction to treat them as one entity — which is the whole point of
 * declaring the organisation in the first place.
 */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;

/** JSON that cannot close a <script> tag, whatever the data contains. */
export function jsonForScriptTag(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * `WebSite` + publisher structured data — the one thing Google Search
 * Central actually documents for getting a brand NAME shown above the URL
 * in a result instead of the raw domain (`aldaftarnews.com`).
 *
 * Emitted as an `@graph` of two linked nodes rather than two loose scripts:
 * the WebSite points at the organisation as its `publisher`, and the
 * organisation carries the id every article's own `publisher` repeats — so
 * the site, its name variants, its logo and every story it has published
 * describe ONE entity instead of several that happen to share a name.
 *
 * Worth being honest about what this can and can't do: the site *name*
 * swap is the one outcome Google documents this schema for. Sitelinks (the
 * row of section links under a result) are entirely algorithmic — Google
 * states plainly there is no markup that requests or guarantees them, only
 * site structure/internal linking clear enough for their own system to
 * decide it's worth generating them, on its own schedule. Nothing here
 * "turns sitelinks on"; it's the technical floor that makes them possible.
 * Nor is any of it instant: Google re-reads the markup on its own crawl
 * schedule, so the name in a live result changes days-to-weeks later.
 *
 * `NewsMediaOrganization` rather than a plain `Organization`: it is a
 * subtype of it — everything that reads Organization reads this — and it is
 * already what articleJsonLd declares as each story's publisher, so the two
 * agree on what kind of thing this newsroom is.
 */
export function siteJsonLd({ logo, sameAs = [] }: { logo?: string; sameAs?: string[] } = {}): string {
  const names = { name: SITE_NAME.ar, alternateName: [...SITE_ALTERNATE_NAMES] };
  return jsonForScriptTag({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        ...names,
        url: SITE_URL,
        inLanguage: "ar",
        description: SITE_DESCRIPTION.ar,
        publisher: { "@id": ORGANIZATION_ID },
      },
      {
        "@type": "NewsMediaOrganization",
        "@id": ORGANIZATION_ID,
        ...names,
        url: SITE_URL,
        description: SITE_DESCRIPTION.ar,
        // The masthead the newsroom actually uploaded, not a path hardcoded
        // here — an editor who changes the logo changes what Google reads.
        ...(logo ? { logo: { "@type": "ImageObject", url: logo } } : {}),
        // The newsroom's own profiles. `sameAs` is how a crawler confirms
        // that this site and those accounts are the same organisation,
        // which is the association a knowledge panel is built from.
        ...(sameAs.length ? { sameAs } : {}),
      },
    ],
  });
}

/**
 * `ItemList` of the main section fronts — the clearest, best-supported
 * schema.org shape for "here is this site's primary navigation" (more
 * consistently recognised than `SiteNavigationElement`, which schema.org
 * defines but no major crawler documents parsing). Same honesty as
 * websiteJsonLd: this documents the site's structure for a crawler: it
 * doesn't instruct Google to render it as sitelinks.
 */
export function sectionsItemListJsonLd(sections: Section[]): string {
  return jsonForScriptTag({
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: sections.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.name_ar,
      url: `${SITE_URL}/section/${s.key}`,
    })),
  });
}

/** Title/description/canonical for a section front — every section page
 *  rendered under the same homepage title before this, which is both a
 *  duplicate-title problem in its own right and works against the clear,
 *  distinct, well-linked page structure sitelinks are decided on. */
export function sectionMetadata(section: Section, lang: "ar" | "en"): Metadata {
  const isAr = lang === "ar";
  const name = isAr ? section.name_ar : section.name_en || section.name_ar;
  const url = `${SITE_URL}${isAr ? "" : "/en"}/section/${section.key}`;
  const description = isAr
    ? `أحدث أخبار ${name} في ${SITE_NAME.ar} — تغطية متجددة لحظة بلحظة.`
    : `The latest ${name} news from ${SITE_NAME.en}.`;
  return {
    title: name,
    description,
    alternates: { canonical: url },
    openGraph: { title: name, description, url, type: "website", siteName: SITE_NAME[lang] },
  };
}

/**
 * Guess an image's MIME type from its own URL extension — og:image:type
 * (and the RSS feed's <enclosure type>/<media:content type>, see lib/rss.ts)
 * has to name the ACTUAL file's format; every cover on this site is one of
 * these four, uploaded straight through Django's ImageField (which itself
 * only accepts formats Pillow can decode, so this is an exhaustive list in
 * practice, not a guess against arbitrary input).
 */
export function imageMimeType(url: string): string | undefined {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  return { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" }[ext ?? ""];
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
      // A wrong declared width/height is a documented reason Facebook's/
      // WhatsApp's crawler drops an image from a link preview outright
      // rather than rendering it slightly off — 1600x900 was hardcoded
      // here regardless of what the actual file was (most covers on this
      // site are nowhere near that, e.g. a phone photo at 1216x802).
      // cover_image_width/height are the file's real pixels, stamped by
      // Django's ImageField at upload time — see content/models.py.
      // secure_url and an explicit type are the two other tags Meta's own
      // crawler docs list alongside width/height for a reliable preview.
      images: cover
        ? [
            {
              url: cover,
              secureUrl: cover,
              width: article.cover_image_width || 1600,
              height: article.cover_image_height || 900,
              alt: article.cover_caption || article.title,
              type: imageMimeType(cover),
            },
          ]
        : undefined,
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
      // Same id as the site-wide organisation node (see siteJsonLd), so
      // every story resolves to that one publisher rather than to a fresh
      // anonymous object per article. name/url stay spelled out: Google's
      // article documentation lists publisher.name as required, and a bare
      // reference would satisfy the graph but not that requirement.
      "@id": ORGANIZATION_ID,
      name: SITE_NAME[article.language === "en" ? "en" : "ar"],
      url: SITE_URL,
    },
    articleSection: article.section?.name_ar || undefined,
  });
}
