"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { sectionArtUrl, sectionColor } from "@/lib/sections";
import type { Section } from "@/lib/types";

const T = {
  ar: {
    open: "الأقسام",
    close: "إغلاق",
    search: "ابحث في الموقع",
    placeholder: "ابحث في الدفتر نيوز…",
    sections: "الأقسام",
    quick: "روابط سريعة",
    panel: "قائمة التنقل",
    lang: "English",
    home: "الرئيسية",
  },
  en: {
    open: "Sections",
    close: "Close",
    search: "Search the site",
    placeholder: "Search Al Daftar News…",
    sections: "Sections",
    quick: "Quick links",
    panel: "Navigation menu",
    lang: "العربية",
    home: "Home",
  },
};

/**
 * Slide-out navigation drawer opened from the masthead hamburger.
 *
 * The client asked for the hamburger on the inline-start side and search on
 * the inline-end, so the drawer enters from the start edge to match the
 * control that opened it — which in RTL is the right-hand side.
 *
 * Every row carries its own section's colour as a bar on the leading edge.
 * The list was thirteen identical rows before, which is a wall of text with no
 * way in; the colour is the same one the section's heading rule, card kickers
 * and nav underline already use, so the drawer teaches the system rather than
 * inventing decoration for itself.
 */
export default function NavDrawer({
  lang,
  sections,
  extraLinks,
  active = "",
  logoSrc,
}: {
  lang: "ar" | "en";
  sections: Section[];
  extraLinks: { label: string; href: string }[];
  /** Current section key, so the drawer can say where the reader already is. */
  active?: string;
  logoSrc?: string;
}) {
  const isAr = lang === "ar";
  const t = T[lang];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const panelRef = useRef<HTMLElement>(null);

  /**
   * The drawer carries its own search field rather than reusing the masthead
   * SearchBox: that one opens a full-screen navy panel, which on top of an
   * already-open drawer is two overlays deep. This is a plain field that
   * hands off to /search — a reader who opened the menu to go somewhere gets
   * the shortest path there.
   */
  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    setQuery("");
    router.push(`${isAr ? "" : "/en"}/search?q=${encodeURIComponent(q)}`);
  };

  // A drawer that survives navigation would cover the page it just opened.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // Move focus into the panel, not into the search box: autofocusing a text
    // field here pops the on-screen keyboard over the menu the reader just
    // asked to see.
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={t.open}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-10 flex-shrink-0 items-center gap-2 rounded px-2 text-ink transition-colors duration-fast hover:bg-surface-2"
      >
        <span className="flex flex-col gap-[5px]" aria-hidden>
          <span className="block h-[2px] w-[22px] bg-ink" />
          <span className="block h-[2px] w-[22px] bg-ink" />
          <span className="block h-[2px] w-[22px] bg-ink" />
        </span>
        {/* Named on wide screens. The client calls this control «عرض الأقسام»,
            and a bare icon makes the reader guess. */}
        <span className="hidden text-[13.5px] font-bold lg:inline">{t.open}</span>
      </button>

      {/* Portalled to <body>: the drawer renders inside the sticky masthead,
          and `fixed` inside that stack resolved against the wrong box — the
          panel floated clear of the screen edge with its header pushed above
          the viewport. From the body it can only mean "the viewport". */}
      {open
        ? createPortal(
            <>
          <div
            role="presentation"
            onClick={() => setOpen(false)}
            className="animate-fade-in fixed inset-0 z-[90] bg-[rgba(6,38,57,.6)]"
          />
          <aside
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={t.panel}
            className={`fixed bottom-0 start-0 top-0 z-[91] flex w-[400px] max-w-[92vw] flex-col bg-navy text-header-ink shadow-2 outline-none ${
              isAr ? "animate-drawer-in-rtl" : "animate-drawer-in-ltr"
            }`}
            dir={isAr ? "rtl" : "ltr"}
          >
            <div className="flex items-center justify-between gap-3 border-b border-navy-2 px-4 py-3.5">
              {/* The mark, not the word «الأقسام» — the drawer is the site's
                  front door on mobile and should say whose site it is. */}
              <Link href={isAr ? "/" : "/en"} onClick={() => setOpen(false)} className="min-w-0 no-underline">
                {logoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoSrc} alt={isAr ? "الدفتر مصر" : "Al Daftar Masr"} className="h-9 w-auto object-contain brightness-0 invert" />
                ) : (
                  <span className="rule-accent rule-on-dark ps-3.5 text-[17px] font-extrabold">
                    {isAr ? "الدفتر نيوز" : "Al Daftar News"}
                  </span>
                )}
              </Link>
              <button
                type="button"
                aria-label={t.close}
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-navy-2 text-[16px] text-header-muted transition-colors duration-fast hover:border-brand hover:bg-brand hover:text-paper"
              >
                ✕
              </button>
            </div>

            {/* White field on the navy panel, above the section list — the
                arrangement the client pointed at. */}
            <form onSubmit={submitSearch} className="border-b border-navy-2 px-4 py-3.5" role="search">
              <label className="sr-only" htmlFor="drawer-search">
                {t.search}
              </label>
              <div className="flex items-center gap-2 rounded-pill bg-paper px-3.5 py-2">
                <svg viewBox="0 0 20 20" fill="none" aria-hidden className="h-4 w-4 flex-shrink-0 text-ink-3">
                  <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="m13.5 13.5 3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <input
                  id="drawer-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.placeholder}
                  className="min-w-0 flex-1 border-none bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
                />
              </div>
            </form>

            <nav className="flex-1 overflow-y-auto px-4 py-4" aria-label={t.open}>
              {/* Tile grid, the pattern of the big newsrooms' drawers (الشرق,
                  Sky News عربية): every section visible at once as a card
                  with its own mark and colour, instead of a thirteen-row
                  list the thumb has to travel. */}
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-header-muted">{t.sections}</div>
              <div className="grid grid-cols-2 gap-2.5">
                {sections.map((s) => {
                  const isHere = s.key === active;
                  const color = sectionColor(s.key);
                  const art = sectionArtUrl(s.key, "#D9E5EF");
                  return (
                    <Link
                      key={s.key}
                      href={isAr ? `/section/${s.key}` : `/en/section/${s.key}`}
                      onClick={() => setOpen(false)}
                      aria-current={isHere ? "page" : undefined}
                      className={`group relative flex flex-col gap-2 overflow-hidden rounded-card border p-3 pt-3.5 no-underline transition-colors duration-fast ${
                        isHere ? "border-transparent bg-navy-2 text-paper" : "border-navy-2/70 bg-navy-2/30 text-header-ink hover:bg-navy-2"
                      }`}
                      style={isHere ? { borderColor: color } : undefined}
                    >
                      {/* The section's own colour — the same value its heading
                          rule, card kickers and nav underline use. */}
                      <span
                        className="absolute start-0 top-0 h-full w-[3px] transition-all duration-fast group-hover:w-[4px]"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                      {art ? (
                        <span
                          aria-hidden
                          className="h-8 w-14 bg-contain bg-center bg-no-repeat opacity-70 transition-opacity duration-fast group-hover:opacity-100"
                          style={{ backgroundImage: art }}
                        />
                      ) : (
                        <span aria-hidden className="h-8 w-14" />
                      )}
                      <span className="min-w-0 truncate text-[13.5px] font-bold">{isAr ? s.name_ar : s.name_en || s.name_ar}</span>
                    </Link>
                  );
                })}
              </div>

              {extraLinks.length ? (
                <div className="mt-5">
                  {/* Labelled, so the secondary block reads as a different kind
                      of destination instead of thirteen sections plus five
                      strays. */}
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-header-muted">{t.quick}</div>
                  <div className="flex flex-wrap gap-2">
                    {extraLinks.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        onClick={() => setOpen(false)}
                        className="rounded-pill border border-navy-2 px-3.5 py-1.5 text-[12.5px] font-semibold text-header-muted no-underline transition-colors duration-fast hover:border-accent-soft hover:bg-navy-2 hover:text-paper"
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </nav>

            <div className="flex items-center justify-between gap-3 border-t border-navy-2 px-4 py-3">
              <Link
                href={isAr ? "/" : "/en"}
                onClick={() => setOpen(false)}
                className="text-[13px] font-bold text-header-ink no-underline transition-colors duration-fast hover:text-paper"
              >
                {t.home}
              </Link>
              <Link
                href={isAr ? "/en" : "/"}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 rounded-pill border border-navy-2 px-3.5 py-1.5 text-[13px] font-bold text-header-ink no-underline transition-colors duration-fast hover:border-accent-soft hover:text-paper"
              >
                {t.lang}
              </Link>
            </div>
          </aside>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
