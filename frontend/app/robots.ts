import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The raw API is not for crawlers; /login carries ?next= values that
        // would otherwise multiply into indexed noise.
        //
        // The newsroom's own path is deliberately NOT listed here. robots.txt
        // is world-readable and is the first file any scanner fetches, so a
        // Disallow line naming a deliberately obscure admin URL publishes the
        // very thing it was renamed to hide — the classic way this backfires.
        // It is kept out of search by `robots: { index: false }` on the
        // newsroom layout instead, which is a directive to the crawler rather
        // than an announcement to everyone.
        disallow: ["/login", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
