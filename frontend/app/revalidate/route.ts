import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { CONTENT_TAG } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Drops the cached render of the public site, on demand.
 *
 * The dashboard already calls revalidateSite() after a save, but that only
 * covers stories published through the editor. Three other paths reach the
 * same database and never touched Next's cache:
 *
 *   - the scheduled publisher (`manage.py publish_scheduled`, on cron), which
 *     is how a story timed for the morning goes live;
 *   - the Django admin;
 *   - anything writing to the API directly.
 *
 * A story published any of those ways sat invisible until the page's own TTL
 * expired, which is exactly the "publishing does not update the home page"
 * the newsroom reported. So the backend now pings this route whenever an
 * article's published state changes (see content/signals.py), and every path
 * is covered rather than the one that happened to have a hook.
 *
 * NOT under /api/ deliberately: nginx proxies that prefix to Django, so a
 * route there would never reach Next at all. The backend calls this on
 * 127.0.0.1:3300 directly.
 *
 * The token is required and compared in constant time. Without it this is an
 * unauthenticated endpoint that lets anyone flush the cache of every page on
 * the site as fast as they can send requests.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: NextRequest) {
  const expected = process.env.REVALIDATE_TOKEN;
  // No token configured means the deployment never opted in; refuse rather
  // than fall open.
  if (!expected) {
    return NextResponse.json({ revalidated: false, reason: "not-configured" }, { status: 503 });
  }

  const supplied = request.headers.get("x-revalidate-token") ?? "";
  if (!safeEqual(supplied, expected)) {
    return NextResponse.json({ revalidated: false }, { status: 401 });
  }

  // Both, and both are needed.
  //
  // revalidateTag drops every CACHED READ of the API (lib/api's CONTENT_TAG).
  // Without it the rendered route is rebuilt from fetch entries still sitting
  // in the Data Cache under their own TTL — which is exactly how a published
  // story reached its section page and not the home page.
  //
  // revalidatePath then drops the rendered output itself, across the whole
  // tree under the root layout, so nothing serves a stale render of
  // now-fresh data.
  // { expire: 0 } — expire now, not at the end of some profile's window.
  // Next 16 made the profile argument required; the default would have left
  // the entries alive for their normal lifetime, which is the very thing
  // this endpoint exists to cut short.
  revalidateTag(CONTENT_TAG, { expire: 0 });
  revalidatePath("/", "layout");

  return NextResponse.json({ revalidated: true, at: Date.now() });
}
