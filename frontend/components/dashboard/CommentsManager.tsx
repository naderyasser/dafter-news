"use client";

import { useState } from "react";

import StatusBadge from "@/components/dashboard/StatusBadge";
import { apiMutate } from "@/lib/api";
import type { Comment } from "@/lib/types";

const STATUS_KEY: Record<Comment["status"], string> = { pending: "review", approved: "active", banned: "rejected" };

export default function CommentsManager({ comments: initial }: { comments: Comment[] }) {
  const [comments, setComments] = useState(initial);
  const [filter, setFilter] = useState<Comment["status"] | "all">("pending");

  const setStatus = async (id: number, status: Comment["status"]) => {
    setComments((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));
    try {
      await apiMutate(`/comments/${id}/`, "PATCH", { status });
    } catch {}
  };

  const filtered = filter === "all" ? comments : comments.filter((c) => c.status === filter);
  const chips: { key: Comment["status"] | "all"; label: string }[] = [
    { key: "pending", label: "معلّق" },
    { key: "approved", label: "مقبول" },
    { key: "banned", label: "محظور" },
    { key: "all", label: "الكل" },
  ];

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`rounded-pill border px-4 py-2 text-[12.5px] font-semibold ${filter === c.key ? "border-brand bg-brand text-paper" : "border-line bg-paper text-ink"}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-card border border-line bg-paper">
        <div className="grid grid-cols-[1fr_2.4fr_1.6fr_1fr_130px] bg-surface">
          <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">المستخدم</div>
          <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">التعليق</div>
          <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">على الخبر</div>
          <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">الحالة</div>
          <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">إجراءات</div>
        </div>
        {filtered.map((c) => (
          <div key={c.id} className="grid min-h-[52px] grid-cols-[1fr_2.4fr_1.6fr_1fr_130px] items-center border-t border-line">
            <div className="px-3.5 text-[13.5px] font-semibold text-ink">{c.user_name}</div>
            <div className="px-3.5 text-[13.5px] leading-[1.5] text-ink-3">{c.text}</div>
            <div className="px-3.5 text-[13.5px] text-ink-3">{c.article_title}</div>
            <div className="px-3.5">
              <StatusBadge status={STATUS_KEY[c.status]} />
            </div>
            <div className="flex gap-2.5 pe-3.5 text-[15px]">
              <span onClick={() => setStatus(c.id, "approved")} className="cursor-pointer text-up" title="قبول">
                ✓
              </span>
              <span onClick={() => setStatus(c.id, "banned")} className="cursor-pointer text-down" title="رفض">
                ✕
              </span>
              <span onClick={() => setStatus(c.id, "banned")} className="cursor-pointer text-ink-3" title="حظر">
                ⊘
              </span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="p-8 text-center text-ui text-ink-3">لا توجد تعليقات</div>}
      </div>
    </>
  );
}
