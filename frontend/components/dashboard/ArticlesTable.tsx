"use client";

import Link from "next/link";
import { DASHBOARD } from "@/lib/routes";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import StatusBadge from "@/components/dashboard/StatusBadge";
import { dashMutate } from "@/lib/api";
import { revalidateSite } from "@/lib/revalidate";
import type { ArticleStatus } from "@/lib/types";

export type ArticleRow = { id: number; title: string; section: string; author: string; status: ArticleStatus; views: number; date: string };

const STATUS_CHIPS: { key: ArticleStatus | "all"; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "published", label: "منشور" },
  { key: "draft", label: "مسودة" },
  { key: "review", label: "مراجعة" },
  { key: "scheduled", label: "مجدول" },
];

/**
 * `justSaved` is the one visible confirmation an editor gets that «حفظ
 * ونشر»/«حفظ كأرشفة» actually landed — the editor form itself only
 * navigates away with nothing else to look at (see ArticleEditorForm.save),
 * which read as "did that even work?" without this. Read once from the
 * redirect's own `?saved=1` (App Router page props, not a query hook, so
 * this component doesn't need to be wrapped in Suspense) and stripped
 * straight back out of the URL — otherwise a later reload of this same
 * page would keep re-showing a banner for a save that happened minutes ago.
 */
export default function ArticlesTable({
  rows: initialRows,
  justSaved = false,
  initialQuery = "",
}: {
  rows: ArticleRow[];
  justSaved?: boolean;
  /** From the top bar's search box (?q=) — the table opens already filtered. */
  initialQuery?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | "all">("all");
  const [query, setQuery] = useState(initialQuery);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [error, setError] = useState("");
  const [showSaved, setShowSaved] = useState(justSaved);

  useEffect(() => {
    if (justSaved) router.replace(`${DASHBOARD}/articles`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () => rows.filter((a) => (statusFilter === "all" || a.status === statusFilter) && (!query.trim() || a.title.includes(query.trim()))),
    [rows, statusFilter, query],
  );
  const selectedCount = Object.values(selected).filter(Boolean).length;

  const toggle = (id: number) => setSelected((s) => ({ ...s, [id]: !s[id] }));

  // A failed delete/publish that stays optimistic looks identical to a
  // successful one until the next reload — the row is gone (or "published")
  // in front of the editor, then reappears unpublished after a refresh with
  // no explanation. Reverting on failure and saying so keeps what's on
  // screen honest with what's actually saved.
  const remove = async (id: number, title: string) => {
    if (!confirm(`حذف «${title}» نهائياً؟`)) return;
    const before = rows;
    setRows((r) => r.filter((a) => a.id !== id));
    setError("");
    try {
      await dashMutate(`/articles/${id}/`, "DELETE");
      // Without this the public home page kept the deleted story's card up
      // to a minute after it was actually gone from the database — a
      // "ghost card" the editor had just confirmed deleting.
      revalidateSite().catch(() => {});
    } catch {
      setRows(before);
      setError(`تعذّر حذف «${title}». لم يُحذف الخبر — حاول مرة أخرى.`);
    }
  };
  const bulkAction = async (action: "publish" | "archive" | "delete") => {
    const ids = Object.keys(selected).filter((id) => selected[+id]).map(Number);
    if (!ids.length) return;
    if (action === "delete") {
      if (!confirm(`حذف ${ids.length} خبر نهائياً؟`)) return;
      const before = rows;
      setRows((r) => r.filter((a) => !ids.includes(a.id)));
      setError("");
      const results = await Promise.allSettled(ids.map((id) => dashMutate(`/articles/${id}/`, "DELETE")));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed) {
        setRows(before);
        setError(`تعذّر حذف ${failed} من ${ids.length} خبر. لم يُحذف أي منها — حاول مرة أخرى.`);
      } else {
        revalidateSite().catch(() => {});
      }
    } else if (action === "publish") {
      const before = rows;
      setRows((r) => r.map((a) => (ids.includes(a.id) ? { ...a, status: "published" as const } : a)));
      setError("");
      const results = await Promise.allSettled(ids.map((id) => dashMutate(`/articles/${id}/`, "PATCH", { status: "published" })));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed) {
        setRows(before);
        setError(`تعذّر نشر ${failed} من ${ids.length} خبر. لم يُنشر أي منها — حاول مرة أخرى.`);
      } else {
        revalidateSite().catch(() => {});
      }
    }
    setSelected({});
  };

  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-pill border px-3.5 py-2 text-[13.5px] font-semibold ${active ? "border-brand bg-brand text-paper" : "border-line bg-paper text-ink"}`;

  return (
    <>
      {showSaved ? (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-card border border-up bg-up-tint px-4 py-3 text-[14px] font-semibold text-up"
        >
          تم حفظ الخبر بنجاح.
          <button onClick={() => setShowSaved(false)} aria-label="إغلاق" className="text-up hover:opacity-70">
            ✕
          </button>
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="rounded-card border border-down bg-down-tint px-4 py-3 text-[14px] font-semibold text-down">
          {error}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث في المقالات..."
          className="min-w-[200px] flex-1 rounded-lg border border-line bg-paper px-3.5 py-2.5 text-[14px] outline-none focus:border-brand"
        />
        {STATUS_CHIPS.map((c) => (
          <button key={c.key} onClick={() => setStatusFilter(c.key)} className={chip(statusFilter === c.key)}>
            {c.label}
          </button>
        ))}
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center gap-3.5 rounded-lg border border-brand bg-brand-tint px-4 py-2.5">
          <span className="text-[14px] font-bold text-brand-strong">{selectedCount} عنصر محدد</span>
          <button onClick={() => bulkAction("publish")} className="rounded-md border border-line-strong bg-paper px-3.5 py-1.5 text-[13.5px] font-semibold text-ink">
            نشر
          </button>
          <button onClick={() => bulkAction("archive")} className="rounded-md border border-line-strong bg-paper px-3.5 py-1.5 text-[13.5px] font-semibold text-ink">
            أرشفة
          </button>
          <button onClick={() => bulkAction("delete")} className="rounded-md border border-down bg-paper px-3.5 py-1.5 text-[13.5px] font-semibold text-down">
            حذف
          </button>
          <button onClick={() => setSelected({})} className="ms-auto border-none bg-none text-[14px] font-semibold text-brand-strong">
            إلغاء التحديد
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-card border border-line bg-paper">
        <div className="grid min-w-[900px] grid-cols-[40px_2.2fr_1fr_1fr_1fr_1fr_1fr_150px] items-center bg-surface">
          <div />
          <div className="px-4 py-2.5 text-xs font-bold text-ink-3">العنوان</div>
          <div className="px-4 py-2.5 text-xs font-bold text-ink-3">القسم</div>
          <div className="px-4 py-2.5 text-xs font-bold text-ink-3">الكاتب</div>
          <div className="px-4 py-2.5 text-xs font-bold text-ink-3">الحالة</div>
          <div className="px-4 py-2.5 text-xs font-bold text-ink-3">المشاهدات</div>
          <div className="px-4 py-2.5 text-xs font-bold text-ink-3">التاريخ</div>
          <div />
        </div>
        {filtered.map((a) => (
          <div key={a.id} className="grid min-h-[44px] min-w-[900px] grid-cols-[40px_2.2fr_1fr_1fr_1fr_1fr_1fr_150px] items-center border-t border-line">
            <div className="ps-3.5">
              <span
                onClick={() => toggle(a.id)}
                className={`flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded text-xs text-paper ${
                  selected[a.id] ? "bg-brand" : "border border-line-strong bg-paper"
                }`}
              >
                {selected[a.id] ? "✓" : ""}
              </span>
            </div>
            <div dir="auto" className="truncate px-4 text-start text-[14.5px] font-semibold text-ink">{a.title}</div>
            <div className="px-4 text-[14.5px] text-ink-3">{a.section}</div>
            <div className="px-4 text-[14.5px] text-ink-3">{a.author}</div>
            <div className="px-4">
              <StatusBadge status={a.status} />
            </div>
            <div className="tnum px-4 text-[14.5px] font-semibold text-ink">{a.views ? a.views.toLocaleString("en-US") : "—"}</div>
            <div className="px-4 text-[14.5px] text-ink-3">{a.date}</div>
            {/* Always visible, not hover-only: a control an editor can only
                see by first finding the exact row and hovering it precisely
                reads as "there's no way to do this" — especially on a
                touchscreen, which has no hover state at all. */}
            <div className="flex items-center gap-2 pe-3.5">
              <Link
                href={`${DASHBOARD}/articles/${a.id}/edit`}
                title="تعديل"
                aria-label={`تعديل «${a.title}»`}
                className="flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-[13px] font-semibold text-ink no-underline hover:border-accent hover:text-accent"
              >
                <span aria-hidden>✎</span> تعديل
              </Link>
              <span
                onClick={() => remove(a.id, a.title)}
                title="حذف"
                aria-label={`حذف «${a.title}»`}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-line text-[15px] text-ink-3 hover:border-down hover:text-down"
              >
                🗑
              </span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="p-8 text-center text-ui text-ink-3">لا توجد مقالات مطابقة</div>}
      </div>
    </>
  );
}
