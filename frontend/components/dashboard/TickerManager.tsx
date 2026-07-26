"use client";

import { useState } from "react";

import { apiMutate } from "@/lib/api";
import type { TickerModule } from "@/lib/types";

export default function TickerManager({ items: initial }: { items: TickerModule[] }) {
  const [items, setItems] = useState(initial);

  const move = async (id: number, dir: -1 | 1) => {
    const i = items.findIndex((x) => x.id === id);
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const arr = [...items];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setItems(arr);
    try {
      await Promise.all([apiMutate(`/ticker-modules/${arr[i].id}/`, "PATCH", { order: i }), apiMutate(`/ticker-modules/${arr[j].id}/`, "PATCH", { order: j })]);
    } catch {}
  };

  const toggle = async (id: number) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const next = !it.active;
    setItems((its) => its.map((x) => (x.id === id ? { ...x, active: next } : x)));
    try {
      await apiMutate(`/ticker-modules/${id}/`, "PATCH", { active: next });
    } catch {}
  };

  return (
    <>
      <p className="m-0 text-[13px] text-ink-3">التحكم في العناصر الظاهرة بالشريط اللاصق أسفل الموقع وترتيبها ومصدر تحديثها.</p>
      <div className="overflow-hidden rounded-card border border-line bg-paper">
        {items.map((it) => (
          <div key={it.id} className="flex min-h-[44px] items-center gap-3.5 border-t border-line px-4 py-3 first:border-t-0">
            <div className="flex flex-col gap-0.5 text-[11px] text-header-muted">
              <span onClick={() => move(it.id, -1)} className="cursor-pointer">
                ▲
              </span>
              <span onClick={() => move(it.id, 1)} className="cursor-pointer">
                ▼
              </span>
            </div>
            <span className="w-[120px] text-[13.5px] font-bold">{it.label}</span>
            <span className="flex-1 text-xs text-ink-3">المصدر: {it.source}</span>
            <span onClick={() => toggle(it.id)} className={`relative h-5 w-9 flex-shrink-0 cursor-pointer rounded-pill ${it.active ? "bg-brand" : "bg-line-strong"}`}>
              <span className="absolute top-0.5 h-4 w-4 rounded-full bg-paper transition-[inset-inline-start] duration-fast" style={{ insetInlineStart: it.active ? "18px" : "2px" }} />
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-card border border-line bg-paper p-4">
        <span className="text-[13.5px] font-semibold">تكرار التحديث</span>
        <span className="tnum text-[13px] text-ink-3">كل دقيقة واحدة — /api/ticker/</span>
      </div>
    </>
  );
}
