"use client";

import { useMemo, useState } from "react";

import ArticleCard from "@/components/site/ArticleCard";

export type VideoGridItem = {
  id: number;
  href: string;
  title: string;
  section: string;
  time: string;
  badge: "none" | "exclusive";
  imageSrc?: string;
  duration: string;
  comments: number;
};

export default function VideoGrid({ items }: { items: VideoGridItem[] }) {
  const [filter, setFilter] = useState("الكل");
  const sections = useMemo(() => ["الكل", ...Array.from(new Set(items.map((i) => i.section).filter(Boolean)))], [items]);
  const visible = filter === "الكل" ? items : items.filter((i) => i.section === filter);

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        {sections.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-pill border px-4.5 py-2 text-[13px] font-semibold ${
              filter === s ? "border-brand bg-brand text-paper" : "border-line bg-paper text-ink"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
        {visible.map((v) => (
          <ArticleCard
            key={v.id}
            lang="ar"
            variant="standard"
            href={v.href}
            title={v.title}
            section={v.section}
            time={v.time}
            badge={v.badge}
            imageSrc={v.imageSrc}
            isVideo
            videoDuration={v.duration}
            comments={v.comments}
          />
        ))}
      </div>
    </>
  );
}
