"use client";

import { useEffect, useState } from "react";

import { API_URL, dashMutate } from "@/lib/api";
import type { BreakingNewsItem } from "@/lib/types";

type PushInfo = { configured: boolean; subscribers: number };

export default function BreakingManager({ items: initial }: { items: BreakingNewsItem[] }) {
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [push, setPush] = useState<PushInfo | null>(null);
  const [sending, setSending] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/push/status/`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setPush)
      .catch(() => setPush(null));
  }, []);

  // A save that fails has to say so. These handlers used to swallow the error
  // and, in addItem's case, insert a fake local row — so a failed write looked
  // exactly like a successful one until the page was reloaded.
  const fail = (what: string) => setError(`تعذّر ${what}. لم يُحفظ التغيير — حدّث الصفحة وحاول مرة أخرى.`);

  const addItem = async () => {
    const text = draft.trim();
    if (!text) return;
    setError("");
    try {
      const created = await dashMutate<BreakingNewsItem>("/breaking/", "POST", {
        text,
        order: 0,
        active: true,
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      });
      setItems((it) => [created, ...it]);
      setDraft("");
    } catch {
      fail("إضافة الخبر العاجل");
    }
  };

  const move = async (id: number, dir: -1 | 1) => {
    const i = items.findIndex((x) => x.id === id);
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const arr = [...items];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    // Renumber the whole list rather than PATCHing just the two swapped rows'
    // raw array indices — that left every other row's `order` untouched, and
    // since new items are always created with order:0 that quickly produced
    // duplicate order values (ties broken by -created_at) that silently
    // reshuffled the strip on the next fetch. Same fix as
    // TickerManager.move() / TaxonomyManager.move() in this same directory.
    const renumbered = arr.map((it, idx) => ({ ...it, order: idx + 1 }));
    const before = items;
    setItems(renumbered);
    setError("");
    try {
      await Promise.all(renumbered.map((it) => dashMutate(`/breaking/${it.id}/`, "PATCH", { order: it.order })));
    } catch {
      setItems(before);
      fail("إعادة الترتيب");
    }
  };

  const toggle = async (id: number) => {
    const item = items.find((x) => x.id === id);
    if (!item) return;
    setItems((it) => it.map((x) => (x.id === id ? { ...x, active: !x.active } : x)));
    setError("");
    try {
      await dashMutate(`/breaking/${id}/`, "PATCH", { active: !item.active });
    } catch {
      setItems((it) => it.map((x) => (x.id === id ? { ...x, active: item.active } : x)));
      fail("تغيير الحالة");
    }
  };

  const remove = async (id: number) => {
    const before = items;
    setItems((it) => it.filter((x) => x.id !== id));
    setError("");
    try {
      await dashMutate(`/breaking/${id}/`, "DELETE");
    } catch {
      setItems(before);
      fail("الحذف");
    }
  };

  const broadcast = async (item: BreakingNewsItem) => {
    setSending(item.id);
    setError("");
    setNote("");
    try {
      const res = await dashMutate<{ sent: number; failed: number; pruned: number }>("/push/broadcast/", "POST", {
        title: "عاجل",
        body: item.text,
        url: "/",
      });
      setNote(`أُرسل التنبيه إلى ${res.sent} متصفح${res.failed ? ` · فشل ${res.failed}` : ""}.`);
      setPush((p) => (p ? { ...p, subscribers: Math.max(0, p.subscribers - res.pruned) } : p));
    } catch {
      fail("إرسال التنبيه");
    } finally {
      setSending(null);
    }
  };

  return (
    <>
      {error && (
        <div role="alert" className="rounded-card border border-down bg-down-tint px-4 py-3 text-[13px] font-semibold text-down">
          {error}
        </div>
      )}
      {note && (
        <div role="status" className="rounded-card border border-up bg-up-tint px-4 py-3 text-[13px] font-semibold text-up">
          {note}
        </div>
      )}

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

      {push && (
        <div className="rounded-card border border-line bg-paper px-4 py-2.5 text-[12.5px] text-ink-3">
          {push.configured
            ? `تنبيهات المتصفح مفعّلة · ${push.subscribers} مشترك`
            : "تنبيهات المتصفح غير مفعّلة على الخادم (VAPID غير مضبوط)."}
        </div>
      )}

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

            {push?.configured && push.subscribers > 0 && (
              <button
                onClick={() => broadcast(it)}
                disabled={sending === it.id}
                title="أرسل هذا الخبر كتنبيه لكل المشتركين"
                className="flex-shrink-0 rounded-pill border border-line px-3 py-1 text-[12px] font-semibold text-ink-2 hover:border-brand hover:text-brand disabled:opacity-60"
              >
                {sending === it.id ? "…" : "🔔 تنبيه"}
              </button>
            )}

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
