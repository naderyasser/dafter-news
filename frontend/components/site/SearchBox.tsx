"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { API_URL, mediaUrl } from "@/lib/api";
import { relativeTime, toEasternNumerals } from "@/lib/format";
import type { ArticleCard, Paginated, Section } from "@/lib/types";

const RECENT_KEY = "aldaftar:recent-searches";
const MAX_RECENT = 5;

const T = {
  ar: {
    open: "بحث",
    placeholder: "ابحث في الدفتر نيوز…",
    fieldLabel: "ابحث عن خبر، كاتب، أو قسم",
    all: "كل الأقسام",
    recent: "عمليات بحث سابقة",
    latest: "أحدث الأخبار",
    results: "النتائج",
    seeAll: "عرض كل النتائج",
    none: "لا نتائج لـ",
    noneHint: "جرّب كلمة أقصر، أو اختر قسماً من الشريط بالأعلى.",
    failed: "تعذّر الوصول إلى نتائج البحث.",
    failedHint: "تحقّق من الاتصال ثم أعد المحاولة.",
    retry: "أعد المحاولة",
    clearRecent: "مسح",
    close: "إغلاق البحث",
    hintMove: "للتنقل",
    hintOpen: "للفتح",
    hintClose: "للإغلاق",
  },
  en: {
    open: "Search",
    placeholder: "Search Al Daftar News…",
    fieldLabel: "Search for a story, writer or section",
    all: "All sections",
    recent: "Recent searches",
    latest: "Latest stories",
    results: "Results",
    seeAll: "See all results",
    none: "No results for",
    noneHint: "Try a shorter word, or pick a section above.",
    failed: "Could not reach search.",
    failedHint: "Check your connection and try again.",
    retry: "Try again",
    clearRecent: "Clear",
    close: "Close search",
    hintMove: "to move",
    hintOpen: "to open",
    hintClose: "to close",
  },
};

function SearchGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m13.5 13.5 3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** `tone="light"` for the trigger sitting on the paper masthead, `dark` inside the navy panel. */
function Key({ children, tone = "dark" }: { children: React.ReactNode; tone?: "dark" | "light" }) {
  const skin =
    tone === "dark"
      ? "border-navy-2 bg-navy-strong text-header-muted"
      : "border-line bg-paper text-ink-3";
  return <kbd className={`rounded border px-1.5 py-0.5 font-body-en text-[11px] ${skin}`}>{children}</kbd>;
}

export default function SearchBox({ lang, sections = [] }: { lang: "ar" | "en"; sections?: Section[] }) {
  const router = useRouter();
  const isAr = lang === "ar";
  const t = T[isAr ? "ar" : "en"];
  const articleBase = isAr ? "/article" : "/en/article";
  const searchBase = isAr ? "/search" : "/en/search";

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("all");
  const [rows, setRows] = useState<ArticleCard[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [cursor, setCursor] = useState(0);
  // Whether the reader has *chosen* the highlighted row (arrow keys or
  // pointer) since the results last changed. Enter used to open rows[cursor]
  // whenever results existed — but the cursor rests on the first suggestion
  // by default, so typing «مصر» and hitting Enter jumped into whatever
  // article happened to rank first instead of the results page the reader
  // asked for. Enter now searches unless the highlight was deliberate; the
  // palette flow (↓ then ↵) is untouched.
  const [picked, setPicked] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  // Bumped by the error screen's "try again" button so the load effect below
  // reruns even when the query text itself hasn't changed — setQuery(q => q)
  // is an Object.is no-op that React bails out of without a re-render.
  const [retryTick, setRetryTick] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const readRecent = () => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      setRecent(raw ? (JSON.parse(raw) as string[]).slice(0, MAX_RECENT) : []);
    } catch {
      setRecent([]);
    }
  };

  const remember = (term: string) => {
    const v = term.trim();
    if (!v) return;
    const next = [v, ...recent.filter((r) => r !== v)].slice(0, MAX_RECENT);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* private mode — the list just won't persist */
    }
  };

  // ⌘K / Ctrl+K anywhere, and "/" when the reader isn't already typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    readRecent();
    const id = window.setTimeout(() => inputRef.current?.focus(), 40);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const load = useCallback(
    (term: string, sec: string, signal: AbortSignal) => {
      const params = new URLSearchParams({
        page_size: "6",
        language: lang,
        ordering: "-published_at",
      });
      if (term.trim()) params.set("search", term.trim());
      if (sec !== "all") params.set("section__key", sec);

      setState("loading");
      fetch(`${API_URL}/articles/?${params.toString()}`, { signal })
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        })
        .then((data: Paginated<ArticleCard>) => {
          setRows(data.results);
          setTotal(data.count);
          setCursor(0);
          setPicked(false);
          setState("ready");
        })
        .catch((err) => {
          if ((err as Error).name === "AbortError") return;
          // Surfaced rather than swallowed: a dead search that silently shows
          // "no results" is indistinguishable from a genuinely empty query.
          setRows([]);
          setTotal(0);
          setState("error");
        });
    },
    [lang],
  );

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const id = window.setTimeout(() => load(query, section, controller.signal), query ? 180 : 0);
    return () => {
      window.clearTimeout(id);
      controller.abort();
    };
  }, [open, query, section, load, retryTick]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setSection("all");
    setRows([]);
    setState("idle");
  };

  const submit = (term = query) => {
    remember(term);
    const params = new URLSearchParams();
    if (term.trim()) params.set("q", term.trim());
    if (section !== "all") params.set("section", section);
    close();
    router.push(`${searchBase}${params.toString() ? `?${params}` : ""}`);
  };

  const goTo = (row: ArticleCard) => {
    remember(query);
    close();
    router.push(`${articleBase}/${row.slug}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setPicked(true);
      setCursor((c) => Math.min(c + 1, Math.max(rows.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPicked(true);
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (picked && rows[cursor]) goTo(rows[cursor]);
      else submit();
    }
  };

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor, rows]);

  const chips = [{ key: "all", label: t.all }, ...sections.map((s) => ({ key: s.key, label: isAr ? s.name_ar : s.name_en || s.name_ar }))];

  return (
    <>
      {/* trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.open}
        className="group flex w-full max-w-[460px] flex-1 basis-60 items-center gap-2.5 rounded-pill border border-line bg-surface py-2.5 pe-3 ps-3.5 text-start transition-colors duration-fast hover:border-line-strong hover:bg-surface-2 focus:border-brand focus:outline-none"
      >
        <SearchGlyph className="h-4 w-4 flex-shrink-0 text-ink-3 transition-colors duration-fast group-hover:text-brand" />
        <span className="min-w-0 flex-1 truncate text-[14px] text-ink-3">{t.placeholder}</span>
        <Key tone="light">/</Key>
      </button>

      {!open ? null : (
        <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label={t.open}>
          <div role="presentation" onClick={close} className="animate-fade-in absolute inset-0 bg-[rgba(6,38,57,.62)]" />

          <div
            dir={isAr ? "rtl" : "ltr"}
            onKeyDown={onKeyDown}
            className="animate-modal-in relative mx-auto mt-[10vh] flex max-h-[76vh] w-[min(680px,calc(100%-2rem))] flex-col overflow-hidden rounded-card bg-navy shadow-2"
          >
            {/* field */}
            <div className="flex items-center gap-3 border-b border-navy-2 px-5 py-4">
              <SearchGlyph className="h-[18px] w-[18px] flex-shrink-0 text-brand" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.fieldLabel}
                aria-label={t.fieldLabel}
                className="min-w-0 flex-1 border-none bg-transparent text-[16px] text-header-ink placeholder:text-header-muted focus:outline-none"
              />
              <button
                type="button"
                onClick={close}
                aria-label={t.close}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-[15px] text-header-muted transition-colors duration-fast hover:text-header-ink"
              >
                ✕
              </button>
            </div>

            {/* sections */}
            <div className="flex gap-2 overflow-x-auto border-b border-navy-2 px-5 py-3">
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setSection(c.key)}
                  className={`flex-shrink-0 rounded-pill px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-fast ${
                    section === c.key
                      ? "bg-brand text-paper"
                      : "bg-navy-2 text-header-muted hover:text-header-ink"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* body */}
            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
              {state === "error" ? (
                <div className="px-5 py-10 text-center">
                  <div className="text-[15px] font-bold text-header-ink">{t.failed}</div>
                  <div className="mt-1.5 text-[13px] text-header-muted">{t.failedHint}</div>
                  <button
                    type="button"
                    onClick={() => setRetryTick((n) => n + 1)}
                    className="mt-4 rounded-pill bg-brand px-4 py-2 text-[13px] font-bold text-paper"
                  >
                    {t.retry}
                  </button>
                </div>
              ) : state === "ready" && rows.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <div className="text-[15px] font-bold text-header-ink">
                    {t.none} «{query}»
                  </div>
                  <div className="mt-1.5 text-[13px] text-header-muted">{t.noneHint}</div>
                </div>
              ) : (
                <>
                  {!query && recent.length > 0 && (
                    <div className="border-b border-navy-2 px-5 py-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11.5px] font-bold uppercase tracking-wide text-header-muted">{t.recent}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setRecent([]);
                            try {
                              localStorage.removeItem(RECENT_KEY);
                            } catch {
                              /* nothing to clear */
                            }
                          }}
                          className="text-[12px] text-header-muted hover:text-header-ink"
                        >
                          {t.clearRecent}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {recent.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setQuery(r)}
                            className="rounded-pill border border-navy-2 px-3 py-1 text-[12.5px] text-header-ink hover:border-brand"
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="px-5 pb-2 pt-3 text-[11.5px] font-bold uppercase tracking-wide text-header-muted">
                    {query ? `${t.results} · ${isAr ? toEasternNumerals(total) : total}` : t.latest}
                  </div>

                  {rows.map((r, i) => (
                    <button
                      key={r.id}
                      type="button"
                      data-active={i === cursor}
                      onMouseEnter={() => {
                        setPicked(true);
                        setCursor(i);
                      }}
                      onClick={() => goTo(r)}
                      className={`flex w-full items-center gap-3 border-s-[3px] px-5 py-3 text-start transition-colors duration-fast ${
                        i === cursor ? "border-brand bg-navy-2" : "border-transparent"
                      }`}
                    >
                      <span className="h-[42px] w-[58px] flex-shrink-0 overflow-hidden rounded bg-navy-2">
                        {r.cover_image ? (
                          <Image src={mediaUrl(r.cover_image)!} alt="" fill sizes="96px" className="object-cover" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11.5px] font-bold text-brand">{r.section_name}</span>
                        <span className={`mt-0.5 block text-[14px] font-bold leading-[1.5] text-header-ink ${isAr ? "font-display-ar" : "font-display-en"}`}>
                          {r.title}
                        </span>
                        <span className="mt-0.5 block text-[11.5px] text-header-muted">
                          {relativeTime(r.published_at, lang)}
                        </span>
                      </span>
                    </button>
                  ))}

                  {query && total > rows.length && (
                    <button
                      type="button"
                      onClick={() => submit()}
                      className="w-full px-5 py-3.5 text-start text-[13px] font-bold text-brand hover:bg-navy-2"
                    >
                      {t.seeAll} ({isAr ? toEasternNumerals(total) : total})
                    </button>
                  )}
                </>
              )}
            </div>

            {/* keyboard hints */}
            <div className="flex items-center gap-4 border-t border-navy-2 px-5 py-2.5 text-[11.5px] text-header-muted">
              <span className="flex items-center gap-1.5">
                <Key>↑</Key>
                <Key>↓</Key>
                {t.hintMove}
              </span>
              <span className="flex items-center gap-1.5">
                <Key>↵</Key>
                {t.hintOpen}
              </span>
              <span className="flex items-center gap-1.5">
                <Key>esc</Key>
                {t.hintClose}
              </span>
              <Link href={searchBase} onClick={close} className="ms-auto font-bold text-brand no-underline hover:underline">
                {t.seeAll}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
