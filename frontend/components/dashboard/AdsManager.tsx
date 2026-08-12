"use client";

import { useState } from "react";

import { dashMutate } from "@/lib/api";
import type { AdPlacement } from "@/lib/types";

export default function AdsManager({ placements: initial }: { placements: AdPlacement[] }) {
  const [placements, setPlacements] = useState(initial);
  const [error, setError] = useState("");

  const toggle = async (id: number) => {
    const p = placements.find((x) => x.id === id);
    if (!p) return;
    const next = !p.active;
    setPlacements((ps) => ps.map((x) => (x.id === id ? { ...x, active: next } : x)));
    setError("");
    try {
      await dashMutate(`/ads/${id}/`, "PATCH", { active: next });
    } catch {
      setPlacements((ps) => ps.map((x) => (x.id === id ? { ...x, active: !next } : x)));
      setError(`تعذّر تحديث حالة «${p.name}». لم يُحفظ التغيير.`);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <div role="alert" className="rounded-card border border-down bg-down-tint px-4 py-3 text-[14px] font-semibold text-down">
          {error}
        </div>
      ) : null}
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
          <div className="px-3.5 text-[14.5px] font-semibold text-ink">{p.name}</div>
          <div className="px-3.5 text-[14.5px] text-ink-3">{p.size}</div>
          <div className="px-3.5">
            <button
              type="button"
              role="switch"
              aria-checked={p.active}
              aria-label={`${p.active ? "إيقاف" : "تفعيل"} ${p.name}`}
              onClick={() => toggle(p.id)}
              className={`relative inline-block h-5 w-9 cursor-pointer rounded-pill border-none ${p.active ? "bg-brand" : "bg-line-strong"}`}
            >
              <span className="absolute top-0.5 h-4 w-4 rounded-full bg-paper transition-[inset-inline-start] duration-fast" style={{ insetInlineStart: p.active ? "18px" : "2px" }} />
            </button>
          </div>
          <div className="tnum px-3.5 text-[14.5px] text-ink">{p.impressions.toLocaleString("en-US")}</div>
          <div className="tnum px-3.5 text-[14.5px] text-ink">{p.clicks.toLocaleString("en-US")}</div>
          <div className="tnum px-3.5 text-[14.5px] text-ink">{p.ctr.toFixed(2)}%</div>
        </div>
      ))}
      </div>
    </div>
  );
}
