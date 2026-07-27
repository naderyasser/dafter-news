"use client";

import { useState } from "react";

import { dashMutate } from "@/lib/api";
import type { TickerModule } from "@/lib/types";

/** Matches the model's floor — the serializer rejects anything lower. */
const MIN_REFRESH = 15;

export default function TickerManager({ items: initial }: { items: TickerModule[] }) {
  const [items, setItems] = useState(initial);
  const [error, setError] = useState("");

  const patch = async (id: number, body: Partial<TickerModule>, optimistic: TickerModule[]) => {
    const before = items;
    setItems(optimistic);
    try {
      await dashMutate(`/ticker-modules/${id}/`, "PATCH", body);
    } catch {
      setItems(before);
      setError("تعذّر حفظ التغيير.");
    }
  };

  const move = async (id: number, dir: -1 | 1) => {
    const i = items.findIndex((x) => x.id === id);
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const arr = [...items];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    // Renumber the whole list rather than swapping two values. The seeded
    // orders start at 1, so writing the array index straight back left two
    // modules sharing an order, with the tie broken by id.
    const renumbered = arr.map((m, idx) => ({ ...m, order: idx + 1 }));
    const before = items;
    setItems(renumbered);
    try {
      await Promise.all(renumbered.map((m) => dashMutate(`/ticker-modules/${m.id}/`, "PATCH", { order: m.order })));
    } catch {
      setItems(before);
      setError("تعذّر حفظ الترتيب.");
    }
  };

  const toggle = (id: number) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const next = !it.active;
    patch(
      id,
      { active: next },
      items.map((x) => (x.id === id ? { ...x, active: next } : x)),
    );
  };

  const setRefresh = (id: number, seconds: number) =>
    patch(
      id,
      { refresh_seconds: seconds },
      items.map((x) => (x.id === id ? { ...x, refresh_seconds: seconds } : x)),
    );

  return (
    <>
      <p className="m-0 text-[13px] text-ink-3">
        التحكم في العناصر الظاهرة بالشريط اللاصق أسفل الموقع وترتيبها وزمن تحديثها. التغييرات تظهر للزوار فوراً.
      </p>

      {error && (
        <div role="alert" className="rounded-card border border-down bg-down-tint px-4 py-3 text-[13px] font-semibold text-down">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-card border border-line bg-paper">
        {items.map((it, i) => (
          <div key={it.id} className="flex min-h-[52px] flex-wrap items-center gap-3.5 border-t border-line px-4 py-3 first:border-t-0">
            <div className="flex flex-col gap-0.5 text-[11px] text-header-muted">
              <button onClick={() => move(it.id, -1)} disabled={i === 0} aria-label={`تحريك ${it.label} لأعلى`} className="disabled:opacity-30">
                ▲
              </button>
              <button
                onClick={() => move(it.id, 1)}
                disabled={i === items.length - 1}
                aria-label={`تحريك ${it.label} لأسفل`}
                className="disabled:opacity-30"
              >
                ▼
              </button>
            </div>

            <span className="w-[120px] text-[13.5px] font-bold">{it.label}</span>
            <span className="min-w-[140px] flex-1 text-xs text-ink-3">المصدر: {it.source || "—"}</span>

            <label className="flex items-center gap-2 text-xs text-ink-3">
              <span>كل</span>
              <input
                type="number"
                min={MIN_REFRESH}
                step={5}
                defaultValue={it.refresh_seconds}
                onBlur={(e) => {
                  const seconds = Math.max(MIN_REFRESH, Number(e.target.value) || MIN_REFRESH);
                  e.target.value = String(seconds);
                  if (seconds !== it.refresh_seconds) setRefresh(it.id, seconds);
                }}
                aria-label={`زمن تحديث ${it.label} بالثواني`}
                className="tnum w-[72px] rounded-lg border border-line px-2 py-1 text-center text-[12.5px] outline-none focus:border-brand"
              />
              <span>ثانية</span>
            </label>

            <button
              onClick={() => toggle(it.id)}
              role="switch"
              aria-checked={it.active}
              aria-label={`${it.active ? "إخفاء" : "إظهار"} ${it.label}`}
              className={`relative h-5 w-9 flex-shrink-0 rounded-pill ${it.active ? "bg-brand" : "bg-line-strong"}`}
            >
              <span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-paper transition-[inset-inline-start] duration-fast"
                style={{ insetInlineStart: it.active ? "18px" : "2px" }}
              />
            </button>
          </div>
        ))}
      </div>

      <p className="m-0 text-[12px] text-ink-3">
        أقل زمن مسموح به {MIN_REFRESH} ثانية. الشريط يستخدم أقصر زمن بين العناصر المفعّلة، ويتوقف عن الجلب عندما تكون الصفحة في الخلفية.
      </p>
    </>
  );
}
