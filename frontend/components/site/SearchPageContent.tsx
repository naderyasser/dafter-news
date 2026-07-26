"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import ArticleCard from "@/components/site/ArticleCard";
import { API_URL, mediaUrl } from "@/lib/api";
import { relativeTime, toEasternNumerals } from "@/lib/format";
import type { ArticleCard as ArticleCardType, Paginated, Section } from "@/lib/types";

function SearchGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m13.5 13.5 3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function SearchPageContent({
  initial,
  initialTotal = 0,
  initialQuery = "",
  initialSection = "all",
  sections = [],
}: {
  initial: ArticleCardType[];
  initialTotal?: number;
  initialQuery?: string;
  initialSection?: string;
  sections?: Section[];
}) {
  const [query, setQuery] = useState(initialQuery);
  const [section, setSection] = useState(initialSection);
  const [results, setResults] = useState<ArticleCardType[]>(initial);
  const [total, setTotal] = useState(initialTotal);
  const [state, setState] = useState<"ready" | "loading" | "error">("ready");

  // The server already rendered the first result set for these exact params;
  // refetching them on mount would flash the list for nothing.
  const primed = useRef(true);

  const run = useCallback((term: string, sec: string, signal: AbortSignal) => {
    const params = new URLSearchParams({ page_size: "20", language: "ar", ordering: "-published_at" });
    if (term.trim()) params.set("search", term.trim());
    if (sec !== "all") params.set("section__key", sec);

    setState("loading");
    fetch(`${API_URL}/articles/?${params}`, { signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data: Paginated<ArticleCardType>) => {
        setResults(data.results);
        setTotal(data.count);
        setState("ready");
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setResults([]);
        setTotal(0);
        setState("error");
      });
  }, []);

  useEffect(() => {
    if (primed.current) {
      primed.current = false;
      return;
    }
    const controller = new AbortController();
    const id = window.setTimeout(() => run(query, section, controller.signal), 200);
    return () => {
      window.clearTimeout(id);
      controller.abort();
    };
  }, [query, section, run]);

  // Keep the URL in step so a search can be shared or reloaded.
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (section !== "all") params.set("section", section);
    const next = `/search${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState(null, "", next);
  }, [query, section]);

  const chips = [{ key: "all", label: "كل الأقسام" }, ...sections.map((s) => ({ key: s.key, label: s.name_ar }))];

  return (
    <>
      <h1 className="font-display-ar mb-5 border-s-[3px] border-brand ps-4 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)] font-extrabold text-ink">
        البحث
      </h1>

      <div className="relative mb-4">
        <SearchGlyph className="absolute start-5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن خبر، كاتب، أو قسم…"
          aria-label="ابحث عن خبر، كاتب، أو قسم"
          className="w-full rounded-pill border border-line bg-paper py-4 pe-5 ps-14 text-[16px] text-ink shadow-1 outline-none transition-colors duration-fast focus:border-brand"
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {chips.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            aria-pressed={section === s.key}
            className={`rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-fast ${
              section === s.key
                ? "border-brand bg-brand text-paper"
                : "border-line bg-paper text-ink-2 hover:border-line-strong hover:text-ink"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {state === "error" ? (
        <div className="rounded-card border border-line bg-paper px-6 py-14 text-center">
          <div className="text-[16px] font-bold text-ink">تعذّر الوصول إلى نتائج البحث.</div>
          <div className="mt-2 text-[14px] text-ink-3">تحقّق من الاتصال ثم أعد المحاولة.</div>
          <button
            onClick={() => setQuery((q) => q)}
            className="mt-5 rounded-pill bg-brand px-5 py-2.5 text-[13.5px] font-bold text-paper hover:bg-brand-strong"
          >
            أعد المحاولة
          </button>
        </div>
      ) : results.length === 0 && state === "ready" ? (
        <div className="rounded-card border border-line bg-paper px-6 py-14 text-center">
          <div className="text-[16px] font-bold text-ink">لا نتائج لـ «{query}»</div>
          <div className="mt-2 text-[14px] text-ink-3">جرّب كلمة أقصر، أو اختر قسماً آخر من الشريط بالأعلى.</div>
          {section !== "all" && (
            <button
              onClick={() => setSection("all")}
              className="mt-5 rounded-pill border border-line px-5 py-2.5 text-[13.5px] font-bold text-ink hover:border-brand hover:text-brand"
            >
              ابحث في كل الأقسام
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2 text-[14px] text-ink-3">
            <span className="tnum">{toEasternNumerals(total)} نتيجة</span>
            {query ? <span>عن «{query}»</span> : null}
            {state === "loading" ? <span className="text-ink-3">· جارٍ البحث…</span> : null}
          </div>

          <div className={`flex flex-col transition-opacity duration-fast ${state === "loading" ? "opacity-60" : ""}`}>
            {results.map((r) => (
              <div key={r.id} className="border-b border-line py-3">
                <ArticleCard
                  lang="ar"
                  variant="compact"
                  href={`/article/${r.slug}`}
                  title={r.title}
                  section={r.section_name}
                  time={relativeTime(r.published_at, "ar")}
                  badge={r.badge}
                  imageSrc={mediaUrl(r.cover_image)}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
