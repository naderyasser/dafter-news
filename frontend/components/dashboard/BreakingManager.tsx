"use client";

import { useState } from "react";

import { apiMutate } from "@/lib/api";
import type { BreakingNewsItem } from "@/lib/types";

export default function BreakingManager({ items: initial }: { items: BreakingNewsItem[] }) {
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState("");

  const addItem = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    try {
      const created = await apiMutate<BreakingNewsItem>("/breaking/", "POST", {
        text,
        order: 0,
        active: true,
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      });
      setItems((it) => [created, ...it]);
    } catch {
      setItems((it) => [{ id: Date.now(), text, order: 0, active: true, expires_at: "", created_at: "" }, ...it]);
    }
  };

  const move = async (id: number, dir: -1 | 1) => {
    const i = items.findIndex((x) => x.id === id);
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const arr = [...items];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setItems(arr);
    try {
      await Promise.all([apiMutate(`/breaking/${arr[i].id}/`, "PATCH", { order: i }), apiMutate(`/breaking/${arr[j].id}/`, "PATCH", { order: j })]);
    } catch {}
  };

  const toggle = async (id: number) => {
    setItems((it) => it.map((x) => (x.id === id ? { ...x, active: !x.active } : x)));
    const item = items.find((x) => x.id === id);
    try {
      await apiMutate(`/breaking/${id}/`, "PATCH", { active: !item?.active });
    } catch {}
  };

  const remove = async (id: number) => {
    setItems((it) => it.filter((x) => x.id !== id));
    try {
      await apiMutate(`/breaking/${id}/`, "DELETE");
    } catch {}
  };

  return (
    <>
      <div className="flex gap-2.5 rounded-card border border-line bg-paper p-4">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          placeholder="نص الخبر العاجل الجديد..."
          className="flex-1 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand focus:bg-paper"
        />
        <button onClick={addItem} className="rounded-lg bg-brand px-5 text-[13.5px] font-bold text-paper hover:bg-brand-strong">
          إضافة
        </button>
      </div>
      <div className="overflow-hidden rounded-card border border-line bg-paper">
        {items.map((it) => (
          <div key={it.id} className="flex min-h-[44px] items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
            <div className="flex flex-col gap-0.5 text-[11px] text-header-muted">
              <span onClick={() => move(it.id, -1)} className="cursor-pointer">
                ▲
              </span>
              <span onClick={() => move(it.id, 1)} className="cursor-pointer">
                ▼
              </span>
            </div>
            <span className="flex-1 text-[13.5px] text-ink">{it.text}</span>
            <span
              onClick={() => toggle(it.id)}
              className={`relative h-5 w-9 flex-shrink-0 cursor-pointer rounded-pill transition-colors duration-fast ${it.active ? "bg-brand" : "bg-line-strong"}`}
            >
              <span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-paper transition-[inset-inline-start] duration-fast"
                style={{ insetInlineStart: it.active ? "18px" : "2px" }}
              />
            </span>
            <span onClick={() => remove(it.id)} className="cursor-pointer text-[14px] text-down">
              🗑
            </span>
          </div>
        ))}
        {items.length === 0 && <div className="p-6 text-center text-ui text-ink-3">لا توجد أخبار عاجلة</div>}
      </div>
    </>
  );
}
