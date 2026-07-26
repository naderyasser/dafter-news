"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = { key: string; label: string; href: string; icon: string };
type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: "المحتوى",
    items: [
      { key: "overview", label: "نظرة عامة", href: "/dashboard", icon: "⊞" },
      { key: "articles", label: "المقالات", href: "/dashboard/articles", icon: "≡" },
      { key: "breaking", label: "الأخبار العاجلة", href: "/dashboard/breaking", icon: "⚡" },
    ],
  },
  {
    label: "الوسائط والبث",
    items: [
      { key: "videos", label: "الفيديوهات", href: "/dashboard/videos", icon: "▶" },
      { key: "live", label: "البث المباشر", href: "/dashboard/live", icon: "●" },
      { key: "opinion", label: "بالعقل والمنطق", href: "/dashboard/opinion", icon: '"' },
    ],
  },
  {
    label: "التفاعل",
    items: [{ key: "comments", label: "التعليقات", href: "/dashboard/comments", icon: "💬" }],
  },
  {
    label: "الإدارة",
    items: [
      { key: "ads", label: "الإعلانات", href: "/dashboard/ads", icon: "▭" },
      { key: "ticker", label: "شريط الأسواق", href: "/dashboard/ticker", icon: "↗" },
      { key: "media", label: "الوسائط", href: "/dashboard/media", icon: "🖼" },
      { key: "taxonomy", label: "الأقسام والوسوم", href: "/dashboard/taxonomy", icon: "#" },
    ],
  },
  {
    label: "النظام",
    items: [
      { key: "users", label: "المستخدمون والأدوار", href: "/dashboard/users", icon: "👤" },
      { key: "settings", label: "الإعدادات", href: "/dashboard/settings", icon: "⚙" },
    ],
  },
];

export default function AdminSidebar({ active }: { active: string }) {
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 860;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const asideClass = isMobile
    ? `fixed inset-y-0 start-0 z-[95] flex w-[260px] max-w-[82vw] flex-col bg-header-bg shadow-2 ${mobileOpen ? "flex" : "hidden"}`
    : "sticky top-0 flex h-screen w-[260px] flex-shrink-0 flex-col self-start bg-header-bg";

  return (
    <>
      {isMobile && (
        <span
          onClick={() => setMobileOpen((v) => !v)}
          className="fixed top-3.5 start-3.5 z-[96] flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-lg bg-header-bg text-[16px] text-header-ink shadow-2"
        >
          ☰
        </span>
      )}
      {mobileOpen && <div onClick={() => setMobileOpen(false)} className="fixed inset-0 z-[94] bg-[rgba(10,11,13,.5)]" />}
      <aside className={asideClass}>
        <Link href="/dashboard" className="block border-b border-[#2A2F37] px-4 py-5 no-underline">
          <div className="border-s-[3px] border-brand ps-3 font-display-ar text-[17px] font-extrabold text-header-ink">
            الدفتر نيوز
          </div>
          <div className="mt-1 ps-[15px] text-[11px] text-header-muted">لوحة التحكم</div>
        </Link>
        <nav className="flex-1 overflow-y-auto p-2">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <div className="px-2.5 pb-1.5 pt-3.5 text-[11px] font-bold text-[#565D66]">{g.label}</div>
              {g.items.map((it) => {
                const isActive = it.key === active;
                return (
                  <Link
                    key={it.key}
                    href={it.href}
                    className={`my-0.5 flex items-center gap-2.5 rounded-md border-s-[3px] px-2.5 py-2.5 text-[13.5px] no-underline ${
                      isActive
                        ? "border-brand bg-[rgba(176,31,46,.15)] font-bold text-header-ink"
                        : "border-transparent font-medium text-header-muted hover:bg-[rgba(255,255,255,.04)]"
                    }`}
                  >
                    <span className="w-[18px] flex-shrink-0 text-center text-[14px]">{it.icon}</span>
                    <span>{it.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="flex items-center gap-2.5 border-t border-[#2A2F37] p-4">
          <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-ink-2 font-bold text-header-ink">
            م
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold text-header-ink">محرر النظام</div>
            <div className="text-[11px] text-header-muted">محرر</div>
          </div>
        </div>
      </aside>
    </>
  );
}
