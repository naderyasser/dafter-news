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
      </div>
    </div>
  );
}
