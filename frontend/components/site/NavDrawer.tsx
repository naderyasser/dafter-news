"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Section } from "@/lib/types";

/**
 * Slide-out navigation drawer opened from the masthead hamburger.
 *
 * The client asked for the hamburger on the inline-start side and search on
 * the inline-end, so the drawer enters from the start edge to match the
 * control that opened it — which in RTL is the right-hand side.
 */
export default function NavDrawer({
  lang,
  sections,
  extraLinks,
}: {
  lang: "ar" | "en";
  sections: Section[];
  extraLinks: { label: string; href: string }[];
}) {
  const isAr = lang === "ar";
  const [open, setOpen] = useState(false);

  // A drawer that survives navigation would cover the page it just opened.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={isAr ? "القائمة" : "Menu"}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded text-ink transition-colors duration-fast hover:bg-surface-2"
      >
        <span className="flex flex-col gap-[5px]">
          <span className="block h-[2px] w-[22px] bg-ink" />
          <span className="block h-[2px] w-[22px] bg-ink" />
          <span className="block h-[2px] w-[22px] bg-ink" />
        </span>
      </button>

      {open ? (
        <>
          <div
            role="presentation"
            onClick={() => setOpen(false)}
            className="animate-fade-in fixed inset-0 z-[90] bg-[rgba(16,27,51,.55)]"
          />
          <aside
            className="fixed inset-block-0 start-0 z-[91] flex h-full w-[300px] max-w-[85vw] flex-col bg-navy text-header-ink shadow-2"
            dir={isAr ? "rtl" : "ltr"}
          >
            <div className="flex items-center justify-between border-b border-navy-2 px-5 py-4">
              <span className="border-s-[3px] border-brand ps-3 text-[17px] font-extrabold">
                {isAr ? "الأقسام" : "Sections"}
              </span>
              <button
                type="button"
                aria-label={isAr ? "إغلاق" : "Close"}
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded text-[18px] text-header-muted hover:text-header-ink"
              >
                ✕
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-3">
              {sections.map((s) => (
                <Link
                  key={s.key}
                  href={`/section/${s.key}`}
                  onClick={() => setOpen(false)}
                  className="block rounded px-3 py-2.5 text-[14.5px] font-semibold text-header-ink no-underline transition-colors duration-fast hover:bg-navy-2"
                >
                  {isAr ? s.name_ar : s.name_en || s.name_ar}
                </Link>
              ))}
              <div className="my-3 h-px bg-navy-2" />
              {extraLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded px-3 py-2.5 text-[14.5px] font-semibold text-header-muted no-underline transition-colors duration-fast hover:bg-navy-2 hover:text-header-ink"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </aside>
        </>
      ) : null}
    </>
  );
}
