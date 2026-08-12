import Link from "next/link";

export default function AdminTopbar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-5 border-b border-line bg-paper px-6 py-3.5 font-dashboard-ar">
      <div className="relative min-w-[180px] max-w-[420px] flex-1">
        <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[14px] text-header-muted">🔍</span>
        <input
          type="text"
          placeholder="بحث شامل في لوحة التحكم..."
          className="w-full rounded-lg border border-line bg-surface py-2.5 pe-3.5 ps-9 text-[14px] text-ink outline-none focus:border-brand focus:bg-paper"
        />
      </div>
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/articles/new"
          className="whitespace-nowrap rounded-lg bg-brand px-4 py-2.5 text-[14px] font-bold text-paper no-underline hover:bg-brand-strong"
        >
          + خبر جديد
        </Link>
        <span className="relative cursor-pointer text-[16px] text-ink-2">
          🔔<span className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-paper bg-badge-breaking" />
        </span>
        <Link href="/" className="flex items-center gap-1.5 whitespace-nowrap text-[14px] font-semibold text-ink-2 no-underline hover:text-brand">
          👁 معاينة الموقع
        </Link>
      </div>
    </div>
  );
}
