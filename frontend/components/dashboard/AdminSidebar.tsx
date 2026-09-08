"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DASHBOARD } from "@/lib/routes";
import { useEffect, useState } from "react";

import { logout, type Capability, type DashboardPermissions } from "@/lib/api";
import { ROLE_LABELS, type Role } from "@/lib/types";

/** `cap` is the capability the screen needs — the same key the route guard
 *  (lib/dashboardAccess.ts) and the API's permission classes use, so the nav,
 *  the redirect and the 403 can never disagree about who may open what.
 *  Items with no `cap` are open to every invited team member. */
type Item = { key: string; label: string; href: string; icon: string; cap?: Capability };
type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: "المحتوى",
    items: [
      { key: "overview", label: "نظرة عامة", href: DASHBOARD, icon: "⊞" },
      { key: "articles", label: "المقالات", href: `${DASHBOARD}/articles`, icon: "≡" },
      { key: "breaking", label: "الأخبار العاجلة", href: `${DASHBOARD}/breaking`, icon: "⚡", cap: "breaking" },
    ],
  },
  {
    label: "الوسائط",
    items: [
      { key: "videos", label: "الفيديوهات", href: `${DASHBOARD}/videos`, icon: "▶", cap: "videos" },
      // Same capability as the video desk: whoever runs «لقطة وتعليق» runs
      // the shorts shelf too.
      { key: "reels", label: "حصل إيه؟ — ريلز", href: `${DASHBOARD}/reels`, icon: "▮", cap: "videos" },
      { key: "opinion", label: "بالعقل والمنطق", href: `${DASHBOARD}/opinion`, icon: '"', cap: "authors" },
    ],
  },
  {
    label: "التفاعل",
    items: [{ key: "comments", label: "التعليقات", href: `${DASHBOARD}/comments`, icon: "💬", cap: "comments" }],
  },
  {
    label: "الإدارة",
    items: [
      { key: "ads", label: "الإعلانات", href: `${DASHBOARD}/ads`, icon: "▭", cap: "ads" },
      { key: "ticker", label: "شريط الأسواق", href: `${DASHBOARD}/ticker`, icon: "↗", cap: "ticker" },
      { key: "feeds", label: "المصادر الخارجية", href: `${DASHBOARD}/feeds`, icon: "⟳", cap: "feeds" },
      { key: "media", label: "الوسائط", href: `${DASHBOARD}/media`, icon: "🖼" },
      { key: "taxonomy", label: "الأقسام والوسوم", href: `${DASHBOARD}/taxonomy`, icon: "#", cap: "taxonomy" },
    ],
  },
  {
    label: "النظام",
    items: [
      { key: "users", label: "المستخدمون والأدوار", href: `${DASHBOARD}/users`, icon: "👤", cap: "users" },
      { key: "settings", label: "الإعدادات", href: `${DASHBOARD}/settings`, icon: "⚙", cap: "settings" },
    ],
  },
];

export default function AdminSidebar({
  active,
  permissions,
  user,
}: {
  active: string;
  permissions?: DashboardPermissions;
  /** The signed-in account, for the footer card — it used to be a hard-coded
   *  «محرر النظام / محرر» whoever was logged in. */
  user?: { name?: string; username?: string; role?: string };
}) {
  const displayName = (user?.name || user?.username || "").trim() || "حساب الفريق";
  const roleLabel = (user?.role && ROLE_LABELS[user.role as Role]) || "عضو فريق";
  const initial = displayName.replace(/^(د\.|أ\.|م\.)\s*/, "").charAt(0) || "؟";
  // Undefined while the shell has no account to hand (a server render before
  // /auth/me answers): show the full nav rather than briefly blanking it —
  // every link is guarded on its own anyway.
  const allowed = (item: Item) => !item.cap || !permissions || permissions[item.cap];
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  // The one way out of the newsroom that isn't clearing cookies by hand.
  // The session is ended on the API first; `refresh` then re-runs the
  // dashboard layout's own gate, which bounces to /login.
  const signOut = async () => {
    setLeaving(true);
    try {
      await logout();
    } catch {
      // The session may already be gone (expired, or ended in another tab)
      // — either way the right place to land is the login card.
    }
    router.push("/login");
    router.refresh();
  };

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
        <Link href={DASHBOARD} className="block border-b border-[#2A2F37] px-4 py-5 no-underline">
          <div className="rule-accent rule-on-dark ps-3.5 font-display-ar text-[17px] font-extrabold text-header-ink">
            الدفتر نيوز
          </div>
          <div className="mt-1 ps-[15px] text-[12px] text-header-muted">لوحة التحكم</div>
        </Link>
        <nav className="flex-1 overflow-y-auto p-2">
          {GROUPS.map((g) => ({ ...g, items: g.items.filter(allowed) }))
            .filter((g) => g.items.length > 0)
            .map((g) => (
            <div key={g.label}>
              <div className="px-2.5 pb-1.5 pt-3.5 text-[12px] font-bold text-[#565D66]">{g.label}</div>
              {g.items.map((it) => {
                const isActive = it.key === active;
                return (
                  <Link
                    key={it.key}
                    href={it.href}
                    className={`my-0.5 flex items-center gap-2.5 rounded-md border-s-[3px] px-2.5 py-2.5 text-[14.5px] no-underline ${
                      isActive
                        ? "border-brand bg-[rgba(176,31,46,.15)] font-bold text-header-ink"
                        : "border-transparent font-medium text-header-muted hover:bg-[rgba(255,255,255,.04)]"
                    }`}
                  >
                    <span className="w-[18px] flex-shrink-0 text-center text-[15px]">{it.icon}</span>
                    <span>{it.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="flex items-center gap-2.5 border-t border-[#2A2F37] p-4">
          <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-ink-2 font-bold text-header-ink">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-bold text-header-ink">{displayName}</div>
            <div className="text-[12px] text-header-muted">{roleLabel}</div>
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={leaving}
            title="تسجيل الخروج"
            aria-label="تسجيل الخروج"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-header-muted transition-colors hover:bg-[rgba(255,255,255,.06)] hover:text-header-ink disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  );
}
