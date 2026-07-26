"use client";

import { useState } from "react";

import { apiMutate } from "@/lib/api";
import type { AdPlacement } from "@/lib/types";

export default function AdsManager({ placements: initial }: { placements: AdPlacement[] }) {
  const [placements, setPlacements] = useState(initial);

  const toggle = async (id: number) => {
    const p = placements.find((x) => x.id === id);
    if (!p) return;
    const next = !p.active;
    setPlacements((ps) => ps.map((x) => (x.id === id ? { ...x, active: next } : x)));
    try {
      await apiMutate(`/ads/${id}/`, "PATCH", { active: next });
    } catch {}
  };

  return (
    <div className="overflow-hidden rounded-card border border-line bg-paper">
      <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr] bg-surface">
        <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">الموضع</div>
        <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">المقاس</div>
        <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">الحالة</div>
        <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">ظهور</div>
        <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">نقرات</div>
        <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">CTR</div>
      </div>
      {placements.map((p) => (
        <div key={p.id} className="grid min-h-[48px] grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr] items-center border-t border-line">
          <div className="px-3.5 text-[13.5px] font-semibold text-ink">{p.name}</div>
          <div className="px-3.5 text-[13.5px] text-ink-3">{p.size}</div>
          <div className="px-3.5">
            <span
              onClick={() => toggle(p.id)}
              className={`relative inline-block h-5 w-9 cursor-pointer rounded-pill ${p.active ? "bg-brand" : "bg-line-strong"}`}
            >
              <span className="absolute top-0.5 h-4 w-4 rounded-full bg-paper transition-[inset-inline-start] duration-fast" style={{ insetInlineStart: p.active ? "18px" : "2px" }} />
            </span>
          </div>
          <div className="tnum px-3.5 text-[13.5px] text-ink">{p.impressions.toLocaleString("en-US")}</div>
          <div className="tnum px-3.5 text-[13.5px] text-ink">{p.clicks.toLocaleString("en-US")}</div>
          <div className="tnum px-3.5 text-[13.5px] text-ink">{p.ctr.toFixed(2)}%</div>
        </div>
      ))}
    </div>
  );
}
