const MAP: Record<string, { label: string; bg: string; color: string }> = {
  published: { label: "منشور", bg: "bg-up-tint", color: "text-up" },
  draft: { label: "مسودة", bg: "bg-surface-2", color: "text-ink-2" },
  review: { label: "قيد المراجعة", bg: "bg-brand-tint", color: "text-brand" },
  scheduled: { label: "مجدول", bg: "bg-[#FBF3E2]", color: "text-gold" },
  rejected: { label: "مرفوض", bg: "bg-down-tint", color: "text-down" },
  active: { label: "مفعّل", bg: "bg-up-tint", color: "text-up" },
  paused: { label: "متوقف", bg: "bg-surface-2", color: "text-ink-2" },
  admin: { label: "مدير", bg: "bg-brand-tint", color: "text-brand" },
  editor: { label: "محرر", bg: "bg-up-tint", color: "text-up" },
  author: { label: "كاتب", bg: "bg-surface-2", color: "text-ink-2" },
  moderator: { label: "مشرف تعليقات", bg: "bg-[#FBF3E2]", color: "text-gold" },
  pending: { label: "معلّق", bg: "bg-brand-tint", color: "text-brand" },
  approved: { label: "مقبول", bg: "bg-up-tint", color: "text-up" },
  banned: { label: "محظور", bg: "bg-down-tint", color: "text-down" },
};

export default function StatusBadge({ status }: { status: string }) {
  const s = MAP[status] ?? MAP.draft;
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-pill px-2.5 py-[3px] text-xs font-bold ${s.bg} ${s.color}`}>
      {s.label}
    </span>
  );
}
