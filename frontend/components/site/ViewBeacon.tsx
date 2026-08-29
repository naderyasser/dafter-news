"use client";

import { useEffect } from "react";

import { trackArticleView } from "@/lib/api";

/**
 * Counts one read of this article — the writer «الأكثر قراءة» never had.
 *
 * Once per article per half hour, keyed by slug in sessionStorage. A reader
 * working through ten stories counts ten times; refreshing one story forty
 * times in a minute counts once, because a refresh is not a second reading
 * and a chart that can be climbed by holding F5 is worth less than no chart
 * at all.
 *
 * The half-hour expiry (rather than "once, forever, per tab") is what makes
 * the counter observable to the newsroom testing it: coming back to a story
 * later in the day is a genuine second read and now registers as one. It is
 * the same session-timeout idea every analytics product uses, and it keeps
 * the anti-refresh guard where it matters — inside the window someone would
 * actually sit hammering reload.
 *
 * Mounted on the article, opinion and English article pages. Renders
 * nothing; every failure is swallowed.
 */
const REPEAT_AFTER_MS = 30 * 60 * 1000;

export default function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    if (!slug) return;
    const key = `aldaftar:read:${slug}`;
    try {
      const last = Number(sessionStorage.getItem(key));
      // Number("") and Number(null) are 0, and Number("abc") is NaN — both
      // fail this comparison, so a missing or corrupted stamp counts the
      // read rather than silently swallowing it.
      if (last && Date.now() - last < REPEAT_AFTER_MS) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      // Private mode with storage blocked: still count the read — worst
      // case a paranoid browser counts a refresh as a second one.
    }
    trackArticleView(slug);
  }, [slug]);

  return null;
}
