"use server";

import { revalidatePath, updateTag } from "next/cache";

import { CONTENT_TAG } from "@/lib/api";

/**
 * Drops the cached render of every public page.
 *
 * Dashboard pages already read with `revalidate = 0`, so an editor saving a
 * change and reloading the dashboard always saw it. The *public* side is what
 * lagged: the home page holds for 60s, articles 30s, /live 15s. So «أوقف
 * البث» flipped the database instantly and the reader's player kept playing
 * for another quarter minute — the edit looked broken when it had actually
 * worked.
 *
 * `revalidatePath("/", "layout")` invalidates the whole tree under the root
 * layout in one call, which is what we want: a section rename shows in the
 * nav on every page, not just the one that was edited. The per-page TTLs stay
 * as the backstop for changes that arrive from outside the dashboard (a cron
 * sync, the Django admin).
 *
 * Called from client components after a successful mutation. Deliberately
 * returns void and is safe to fire-and-forget — a failed revalidation should
 * never surface as a failed save, since the write itself already landed.
 */
export async function revalidateSite(): Promise<void> {
  // updateTag, not revalidateTag: this runs inside a Server Action, where
  // Next gives updateTag read-your-own-writes semantics — the editor's very
  // next read sees the story it just saved, rather than the one after that.
  // See app/revalidate/route.ts (a route handler, so it uses revalidateTag
  // with an explicit { expire: 0 }) for why the tag matters at all.
  updateTag(CONTENT_TAG);
  revalidatePath("/", "layout");
}
