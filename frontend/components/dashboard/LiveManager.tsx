"use client";

import { useState } from "react";

import { dashMutate } from "@/lib/api";
import type { LiveStream, LiveUpdate } from "@/lib/types";

export default function LiveManager({ stream: initial }: { stream: LiveStream | null }) {
  const [stream, setStream] = useState(initial);
  const [draft, setDraft] = useState("");

  if (!stream) {
    return <div className="rounded-card border border-line bg-paper p-8 text-center text-ui text-ink-3">لا يوجد بث بعد</div>;
  }

  const toggleLive = async () => {
    const next = !stream.is_live;
    setStream((s) => (s ? { ...s, is_live: next } : s));
    try {
      await dashMutate(`/live-streams/${stream.id}/`, "PATCH", { is_live: next });
    } catch {}
  };

  const addUpdate = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    const now = new Date();
    const time_label = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    try {
      const created = await dashMutate<LiveUpdate>("/live-updates/", "POST", { stream: stream.id, time_label, text });
      setStream((s) => (s ? { ...s, updates: [created, ...s.updates] } : s));
    } catch {
      setStream((s) => (s ? { ...s, updates: [{ id: Date.now(), stream: stream.id, time_label, text, created_at: "" }, ...s.updates] } : s));
    }
  };

  const removeUpdate = async (id: number) => {
    setStream((s) => (s ? { ...s, updates: s.updates.filter((u) => u.id !== id) } : s));
    try {
      await dashMutate(`/live-updates/${id}/`, "DELETE");
    } catch {}
  };

  return (
    <div className="flex max-w-[820px] flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-paper p-5">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${stream.is_live ? "animate-pulse-dot bg-badge-breaking" : "bg-header-muted"}`} />
          <div>
            <div className="text-[15px] font-extrabold">{stream.is_live ? "البث نشط الآن" : "البث متوقف"}</div>
            <div className="mt-0.5 text-xs text-ink-3">{stream.title}</div>
          </div>
        </div>
        <button onClick={toggleLive} className={`rounded-lg px-5.5 py-2.5 text-[13.5px] font-bold text-paper ${stream.is_live ? "bg-ink" : "bg-brand"}`}>
          {stream.is_live ? "■ إيقاف البث" : "● بدء البث"}
        </button>
      </div>

      <div className="border-s-[3px] border-brand ps-3.5">
        <h2 className="font-display-ar m-0 text-h3 font-extrabold text-ink">إدارة التغطية اللحظية</h2>
      </div>
      <div className="flex gap-2.5 rounded-card border border-line bg-paper p-4">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addUpdate()}
          placeholder="أضف تحديثاً جديداً للتغطية اللحظية..."
          className="flex-1 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand focus:bg-paper"
        />
        <button onClick={addUpdate} className="rounded-lg bg-brand px-5 text-[13.5px] font-bold text-paper hover:bg-brand-strong">
          نشر
        </button>
      </div>
      <div className="rounded-card border border-line bg-paper px-5 pb-1 pt-5">
        <div className="relative ps-6">
          <div className="absolute bottom-1.5 top-1.5 start-[7px] w-0.5 bg-line" />
          {stream.updates.map((u) => (
            <div key={u.id} className="relative pb-5.5">
              <div className="absolute -start-6 top-0.5 h-4 w-4 rounded-full border-[3px] border-brand bg-paper" />
              <div className="flex justify-between gap-2.5">
                <div>
                  <div className="tnum mb-0.5 text-[14px] font-extrabold text-brand">{u.time_label}</div>
                  <div className="text-[14px] leading-[1.6] text-ink">{u.text}</div>
                </div>
                <span onClick={() => removeUpdate(u.id)} className="flex-shrink-0 cursor-pointer text-[13px] text-down">
                  🗑
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
