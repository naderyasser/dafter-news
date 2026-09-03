import type { Metadata } from "next";
import { headers } from "next/headers";

import { getSiteSettings, mediaUrl } from "@/lib/api";
import { cairo, ibmPlexSansArabic, inter, notoKufiArabic } from "@/lib/fonts";
import { siteJsonLd, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

import "./globals.css";

// Title and description follow the same x-locale header the <html> tag reads
// below. As a static export they were Arabic on every route, which put an
// Arabic <title> on the English edition's tab and in its search snippet.
export async function generateMetadata(): Promise<Metadata> {
  const isEn = (await headers()).get("x-locale") === "en";
  // Next only shallow-merges `openGraph`/`twitter` between a layout and a
  // page: a route with its own (an article, via lib/seo.ts's
  // articleMetadata) fully replaces this, images and all. This is purely
  // the floor under everything that DOESN'T set its own — the homepage,
  // section/tag pages, a 404, an article link shared before it had a cover
  // photo — which otherwise carried no og:image at all and pasted into
  // WhatsApp/Facebook as a bare text card.
  const settings = await getSiteSettings();
  const fallbackImage = mediaUrl(settings?.logo);
  const siteName = SITE_NAME[isEn ? "en" : "ar"];
  return {
    // Base for every relative URL in child metadata (OG images, canonicals),
    // and a title template so an article tab reads «العنوان — الدفتر نيوز»
    // without each page re-stating the suffix.
    metadataBase: new URL(SITE_URL),
    alternates: {
      types: {
        "application/rss+xml": isEn ? "/en/rss.xml" : "/rss.xml",
      },
    },
    // Declared explicitly rather than left to the App Router's app/icon.*
    // file convention, and the files live in public/ — so replacing the
    // artwork is dropping a file at a fixed, obvious path with no rebuild
    // needed to know what the tag will point at. (Keeping BOTH would be a
    // build error: app/favicon.ico and public/favicon.ico claim the same
    // /favicon.ico route.) `shortcut` is the legacy rel older browsers
    // still ask for; `apple` is the touch icon iOS uses on a home screen.
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon.png", type: "image/png", sizes: "192x192" },
      ],
      shortcut: "/favicon.ico",
      apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
    },
    openGraph: {
      siteName,
      locale: isEn ? "en_US" : "ar_EG",
      images: fallbackImage ? [{ url: fallbackImage }] : undefined,
    },
    twitter: {
      card: "summary",
      images: fallbackImage ? [fallbackImage] : undefined,
    },
    // `default` is the title of any page that doesn't set its own — in
    // practice the homepage, which carries the bare brand and nothing else:
    // Google prints the domain on its own line already, so a title that
    // repeats it (or pads it with a tagline) spends the brand's one line in
    // a result saying less. `template` is what every internal page's own
    // title is folded into, so a story reads «العنوان | الدفتر».
    ...(isEn
      ? {
          title: { default: siteName, template: `%s | ${SITE_NAME.en}` },
          description: SITE_DESCRIPTION.en,
        }
      : {
          title: { default: siteName, template: `%s | ${SITE_NAME.ar}` },
          description: SITE_DESCRIPTION.ar,
        }),
  };
}

// The site is bilingual (AR RTL default / EN LTR — brief §4). App Router
// root layouts are shared across every route, so dir/lang/font-family are
// ALSO set on each page's own wrapper div (exactly like the source's
// `<div dir="ltr" lang="en" ...>`) for logical properties to resolve
// correctly. The outer <html lang dir> below still needs to be correct for
// real users (screen readers, browser translate, search engines read
// <html lang> as authoritative) — middleware.ts tags each request with the
// locale implied by its URL so it isn't hardcoded to Arabic on /en/*.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await headers()).get("x-locale") === "en" ? "en" : "ar";
  // Logo and profile links come from the dashboard's own settings, so the
  // publisher Google reads is whatever the newsroom last saved. Same cached
  // fetch generateMetadata above already made — Next dedupes it within the
  // render, so this costs no second request.
  const settings = await getSiteSettings();
  const schema = siteJsonLd({
    logo: mediaUrl(settings?.logo),
    sameAs: (settings?.social_links ?? []).map((s) => s.url).filter(Boolean),
  });
  return (
    <html
      lang={locale}
      dir={locale === "en" ? "ltr" : "rtl"}
      className={`${notoKufiArabic.variable} ${ibmPlexSansArabic.variable} ${inter.variable} ${cairo.variable}`}
    >
      <head>
        {/* Google AdSense site-ownership verification. */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8862600905076788"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        {/* The site's identity — WebSite + publisher, one linked graph.
            Site-wide from the root layout so no page can be the one a
            crawler reaches without it, though the homepage is where Google
            documents reading the site NAME from specifically. Serialised by
            jsonForScriptTag, which escapes «<» so no value can close this
            script tag early. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />
        {children}
      </body>
    </html>
  );
}
