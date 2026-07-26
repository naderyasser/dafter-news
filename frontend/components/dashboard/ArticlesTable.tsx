"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import StatusBadge from "@/components/dashboard/StatusBadge";
import { apiMutate } from "@/lib/api";
import type { ArticleStatus } from "@/lib/types";

export type ArticleRow = { id: number; title: string; section: string; author: string; status: ArticleStatus; views: number; date: string };

const STATUS_CHIPS: { key: ArticleStatus | "all"; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "published", label: "منشور" },
  { key: "draft", label: "مسودة" },
  { key: "review", label: "مراجعة" },
  { key: "scheduled", label: "مجدول" },
];

export default function ArticlesTable({ rows: initialRows }: { rows: ArticleRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [hoverRow, setHoverRow] = useState<number | null>(null);

  const filtered = useMemo(
    () => rows.filter((a) => (statusFilter === "all" || a.status === statusFilter) && (!query.trim() || a.title.includes(query.trim()))),
    [rows, statusFilter, query],
  );
  const selectedCount = Object.values(selected).filter(Boolean).length;

  const toggle = (id: number) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const remove = async (id: number) => {
    setRows((r) => r.filter((a) => a.id !== id));
    try {
      await apiMutate(`/articles/${id}/`, "DELETE");
    } catch {
      // optimistic delete already applied; ignore network errors in this demo build
    }
  };
  const bulkAction = async (action: "publish" | "archive" | "delete") => {
    const ids = Object.keys(selected).filter((id) => selected[+id]);
    for (const id of ids) {
      if (action === "delete") await remove(+id);
      else if (action === "publish") {
        setRows((r) => r.map((a) => (a.id === +id ? { ...a, status: "published" } : a)));
        try {
          await apiMutate(`/articles/${id}/`, "PATCH", { status: "published" });
        } catch {}
      }
    }
    setSelected({});
  };

  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-pill border px-3.5 py-2 text-[12.5px] font-semibold ${active ? "border-brand bg-brand text-paper" : "border-line bg-paper text-ink"}`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث في المقالات..."
          className="min-w-[200px] flex-1 rounded-lg border border-line bg-paper px-3.5 py-2.5 text-[13px] outline-none focus:border-brand"
        />
        {STATUS_CHIPS.map((c) => (
          <button key={c.key} onClick={() => setStatusFilter(c.key)} className={chip(statusFilter === c.key)}>
            {c.label}
          </button>
        ))}
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center gap-3.5 rounded-lg border border-brand bg-brand-tint px-4 py-2.5">
          <span className="text-[13px] font-bold text-brand-strong">{selectedCount} عنصر محدد</span>
          <button onClick={() => bulkAction("publish")} className="rounded-md border border-line-strong bg-paper px-3.5 py-1.5 text-[12.5px] font-semibold text-ink">
            نشر
          </button>
          <button onClick={() => bulkAction("archive")} className="rounded-md border border-line-strong bg-paper px-3.5 py-1.5 text-[12.5px] font-semibold text-ink">
            أرشفة
          </button>
          <button onClick={() => bulkAction("delete")} className="rounded-md border border-down bg-paper px-3.5 py-1.5 text-[12.5px] font-semibold text-down">
            حذف
          </button>
          <button onClick={() => setSelected({})} className="ms-auto border-none bg-none text-[13px] font-semibold text-brand-strong">
            إلغاء التحديد
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-card border border-line bg-paper">
        <div className="grid grid-cols-[40px_2.2fr_1fr_1fr_1fr_1fr_1fr_70px] items-center bg-surface">
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
          <div
            key={a.id}
            onMouseEnter={() => setHoverRow(a.id)}
            onMouseLeave={() => setHoverRow(null)}
            className="grid min-h-[44px] grid-cols-[40px_2.2fr_1fr_1fr_1fr_1fr_1fr_70px] items-center border-t border-line"
          >
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
            <div className="truncate px-4 text-[13.5px] font-semibold text-ink">{a.title}</div>
            <div className="px-4 text-[13.5px] text-ink-3">{a.section}</div>
            <div className="px-4 text-[13.5px] text-ink-3">{a.author}</div>
            <div className="px-4">
              <StatusBadge status={a.status} />
            </div>
            <div className="tnum px-4 text-[13.5px] font-semibold text-ink">{a.views ? a.views.toLocaleString("en-US") : "—"}</div>
            <div className="px-4 text-[13.5px] text-ink-3">{a.date}</div>
            <div className="flex gap-2.5 pe-3.5 text-[14px] text-ink-3" style={{ opacity: hoverRow === a.id ? 1 : 0 }}>
              <Link href={`/dashboard/articles/${a.id}/edit`} className="cursor-pointer text-inherit no-underline" title="تعديل">
                ✎
              </Link>
              <span onClick={() => remove(a.id)} className="cursor-pointer" title="حذف">
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
