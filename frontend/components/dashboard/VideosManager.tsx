"use client";

import Link from "next/link";
import { useState } from "react";

import { apiMutate, mediaUrl } from "@/lib/api";
import type { Video } from "@/lib/types";

export default function VideosManager({ videos: initial }: { videos: Video[] }) {
  const [videos, setVideos] = useState(initial);

  const toggle = async (id: number, key: "is_live" | "is_exclusive") => {
    const v = videos.find((x) => x.id === id);
    if (!v) return;
    const next = !v[key];
    setVideos((vs) => vs.map((x) => (x.id === id ? { ...x, [key]: next } : x)));
    try {
      await apiMutate(`/videos/${id}/`, "PATCH", { [key]: next });
    } catch {}
  };

  const chip = (active: boolean, color: "live" | "gold") =>
    `rounded-pill border px-3 py-1 text-[11.5px] font-bold ${
      active ? (color === "live" ? "border-badge-breaking bg-badge-breaking text-paper" : "border-gold bg-gold text-paper") : "border-line bg-paper text-ink"
    }`;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
      {videos.map((v) => (
        <div key={v.id} className="overflow-hidden rounded-card border border-line bg-paper">
          <div className="relative aspect-video bg-surface-2">
            {v.cover_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(v.cover_image)} alt={v.title} className="h-full w-full object-cover" />
            ) : null}
            <span className="tnum absolute bottom-2 start-2 rounded-badge bg-[rgba(23,26,31,.75)] px-1.5 py-0.5 text-xs text-paper">{v.duration_label}</span>
          </div>
          <div className="p-3.5">
            <div className="mb-2 line-clamp-2 text-[13.5px] font-bold leading-[1.5]">{v.title}</div>
            <div className="mb-2.5 flex gap-1.5">
              <button onClick={() => toggle(v.id, "is_live")} className={chip(v.is_live, "live")}>
                مباشر
              </button>
              <button onClick={() => toggle(v.id, "is_exclusive")} className={chip(v.is_exclusive, "gold")}>
                خاص
              </button>
            </div>
            <div className="flex items-center justify-between text-xs text-ink-3">
              <span>💬 {v.comment_count} تعليق</span>
              <Link href="/dashboard/comments" className="font-bold text-brand no-underline">
                إدارة التعليقات
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
