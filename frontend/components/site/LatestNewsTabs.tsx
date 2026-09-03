"use client";

import { useState } from "react";

import ArticleCard from "@/components/site/ArticleCard";

/** `iso` renders a real <time datetime> stamp; `time` stays for the rows
 *  whose caption is NOT a timestamp (the «الأكثر تعليقاً» tab reuses this
 *  slot for a comment count), which must not be marked up as one. */
export type NewsRow = { href: string; title: string; time?: string; iso?: string | null };

export default function LatestNewsTabs({
  lang,
  latest,
  popular,
}: {
  lang: "ar" | "en";
  latest: NewsRow[];
  popular: NewsRow[];
}) {
  const [tab, setTab] = useState<"latest" | "popular">("latest");
  const isAr = lang === "ar";
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const rows = tab === "latest" ? latest : popular;

  const chip = (active: boolean) =>
    `rounded-pill border px-4 py-2 text-[13px] font-semibold ${
      active ? "border-brand bg-brand text-paper" : "border-line bg-paper text-ink"
    }`;

  return (
    <div className="flex-[2_1_480px]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-4 rule-accent ps-3.5">
        <h2 className={`${fontDisplay} m-0 text-[clamp(1.1875rem,1rem+0.8vw,1.375rem)] font-extrabold text-ink`}>
          {isAr ? "أحدث الأخبار" : "Latest News"}
        </h2>
        <div className="flex gap-2">
          <button onClick={() => setTab("latest")} className={chip(tab === "latest")}>
            {isAr ? "الأحدث" : "Latest"}
          </button>
          <button onClick={() => setTab("popular")} className={chip(tab === "popular")}>
            {isAr ? "الأكثر تعليقاً" : "Most Commented"}
          </button>
        </div>
      </div>
      <div>
        {rows.map((n, i) => (
          <ArticleCard key={n.href + i} lang={lang} variant="text" href={n.href} title={n.title} time={n.time} iso={n.iso} />
        ))}
        {/*
          «الأكثر تعليقاً» can now legitimately come back empty, and that is the
          point of the fix rather than a hole in it.

          The tab used to be fed an unfiltered `-comment_count` ranking. Almost
          every story carries zero comments, so they all tied at the top of
          that sort and the tie broke on `-published_at` — the tab rendered the
          newest stories, an exact copy of «الأحدث» beside it, which is what
          the newsroom reported as the two tabs being swapped. The pool is now
          filtered to stories that actually have an approved comment (see
          lib/api.ts's getMostCommented), so on a quiet day it has nothing to
          rank. Saying so is honest; silently echoing the other tab was not.

          Only the popular tab gets this: «الأحدث» is topped up from the full
          list and can never be empty, so an empty state there would be a
          message for a state that cannot happen.
        */}
        {rows.length === 0 && tab === "popular" && (
          <p className="m-0 border-t border-line py-6 text-center text-ui text-ink-3">
            {isAr ? "لا توجد أخبار عليها تعليقات بعد." : "No stories have been commented on yet."}
          </p>
        )}
      </div>
    </div>
  );
}
