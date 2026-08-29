import { NextResponse } from "next/server";

import { SITE_URL } from "@/lib/seo";

/**
 * `/feed.xml` → `/rss.xml`, permanently.
 *
 * The feed itself lives at /rss.xml and has since the site launched — it is
 * what <head>'s alternate link advertises (app/layout.tsx) and what anything
 * already subscribed is polling. /feed.xml is the other name readers and
 * submission forms habitually guess, so it answers rather than 404s; a
 * redirect rather than a second copy of the document, because two URLs
 * serving the same items is exactly how a feed reader ends up showing every
 * story twice.
 */
// The target is built from SITE_URL, not from the incoming request: behind
// nginx the request Next sees is the proxied one (http://localhost:3000/…),
// so `new URL("/rss.xml", request.url)` sent subscribers a Location header
// pointing at the origin server's own loopback address — a redirect nobody
// outside this box can follow.
export const dynamic = "force-static";

export function GET() {
  return NextResponse.redirect(`${SITE_URL}/rss.xml`, 308);
}
