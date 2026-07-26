"use client";

import { useEffect, useState } from "react";

import ArticleCard from "@/components/site/ArticleCard";
import { API_URL, mediaUrl } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import type { ArticleCard as ArticleCardType, Paginated } from "@/lib/types";

const SECTIONS = [
  { key: "all", label: "الكل" },
  { key: "egypt", label: "مصر" },
  { key: "economy", label: "اقتصاد" },
  { key: "sports", label: "رياضة" },
];

export default function SearchPageContent({ initial }: { initial: ArticleCardType[] }) {
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("all");
  const [results, setResults] = useState<ArticleCardType[]>(initial);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page_size: "20" });
    if (query.trim()) params.set("search", query.trim());
    if (section !== "all") params.set("section__key", section);
    fetch(`${API_URL}/articles/?${params.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: Paginated<ArticleCardType>) => setResults(data.results))
      .catch(() => {});
    return () => controller.abort();
  }, [query, section]);

  return (
    <>
      <div className="relative mb-5">
        <span className="absolute start-4.5 top-1/2 -translate-y-1/2 text-[18px] text-ink-3">🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن خبر، كاتب، أو موضوع..."
          className="w-full rounded-pill border border-line bg-paper py-4 pe-5 ps-12 text-[16px] text-ink outline-none focus:border-brand"
        />
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`rounded-pill border px-4 py-2 text-[13px] font-semibold ${
              section === s.key ? "border-brand bg-brand text-paper" : "border-line bg-paper text-ink"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="mb-4 text-[14px] text-ink-3">
        {results.length} نتيجة{query ? ` عن "${query}"` : ""}
      </div>
      <div className="flex flex-col">
        {results.map((r) => (
          <div key={r.id} className="border-b border-line py-3">
            <ArticleCard
              lang="ar"
              variant="compact"
              href={`/article/${r.slug}`}
              title={r.title}
              section={r.section_name}
              time={relativeTime(r.published_at, "ar")}
              badge={r.badge}
              imageSrc={mediaUrl(r.cover_image)}
            />
          </div>
        ))}
      </div>
    </>
  );
}
