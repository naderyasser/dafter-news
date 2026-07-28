"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import ArticleCard from "@/components/site/ArticleCard";
import { API_URL, mediaUrl } from "@/lib/api";
import { relativeTime, toEasternNumerals } from "@/lib/format";
import type { ArticleCard as ArticleCardType, Paginated, Section } from "@/lib/types";

const T = {
  ar: {
    title: "البحث",
    placeholder: "ابحث عن خبر، كاتب، أو قسم…",
    allSections: "كل الأقسام",
    failed: "تعذّر الوصول إلى نتائج البحث.",
    failedHint: "تحقّق من الاتصال ثم أعد المحاولة.",
    retry: "أعد المحاولة",
    noneFor: "لا نتائج لـ",
    noneHint: "جرّب كلمة أقصر، أو اختر قسماً آخر من الشريط بالأعلى.",
    searchAllSections: "ابحث في كل الأقسام",
    results: "نتيجة",
    about: "عن",
    searching: "جارٍ البحث…",
  },
  en: {
    title: "Search",
    placeholder: "Search for a story, writer or section…",
    allSections: "All sections",
    failed: "Could not reach search.",
    failedHint: "Check your connection and try again.",
    retry: "Try again",
    noneFor: "No results for",
    noneHint: "Try a shorter word, or pick another section above.",
    searchAllSections: "Search all sections",
    results: "results",
    about: "for",
    searching: "Searching…",
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

export default function SearchPageContent({
  lang = "ar",
  initial,
  initialTotal = 0,
  initialQuery = "",
  initialSection = "all",
  sections = [],
}: {
  lang?: "ar" | "en";
  initial: ArticleCardType[];
  initialTotal?: number;
  initialQuery?: string;
  initialSection?: string;
  sections?: Section[];
}) {
  const isAr = lang === "ar";
  const t = T[isAr ? "ar" : "en"];
  const articleBase = isAr ? "/article" : "/en/article";
  const searchBase = isAr ? "/search" : "/en/search";

  const [query, setQuery] = useState(initialQuery);
  const [section, setSection] = useState(initialSection);
  const [results, setResults] = useState<ArticleCardType[]>(initial);
  const [total, setTotal] = useState(initialTotal);
  const [state, setState] = useState<"ready" | "loading" | "error">("ready");
  // Bumped by the error screen's "try again" button so the refetch effect
  // below reruns even when the query text itself hasn't changed —
  // setQuery(q => q) is an Object.is no-op that React bails out of without a
  // re-render, so it can't be relied on to retrigger the effect on its own.
  const [retryTick, setRetryTick] = useState(0);

  // The server already rendered the first result set for these exact params;
  // refetching them on mount would flash the list for nothing.
  const primed = useRef(true);

  const run = useCallback(
    (term: string, sec: string, signal: AbortSignal) => {
      const params = new URLSearchParams({ page_size: "20", language: lang, ordering: "-published_at" });
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
    },
    [lang],
  );

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
  }, [query, section, run, retryTick]);

  // Keep the URL in step so a search can be shared or reloaded.
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (section !== "all") params.set("section", section);
    const next = `${searchBase}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState(null, "", next);
  }, [query, section, searchBase]);

  const chips = [{ key: "all", label: t.allSections }, ...sections.map((s) => ({ key: s.key, label: isAr ? s.name_ar : s.name_en || s.name_ar }))];

  return (
    <>
      <h1
        className={`mb-5 rule-accent ps-4 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)] font-extrabold text-ink ${
          isAr ? "font-display-ar" : "font-display-en"
        }`}
      >
        {t.title}
      </h1>

      <div className="relative mb-4">
        <SearchGlyph className="absolute start-5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.placeholder}
          aria-label={t.placeholder}
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
          <div className="text-[16px] font-bold text-ink">{t.failed}</div>
          <div className="mt-2 text-[14px] text-ink-3">{t.failedHint}</div>
          <button
            onClick={() => setRetryTick((n) => n + 1)}
            className="mt-5 rounded-pill bg-brand px-5 py-2.5 text-[13.5px] font-bold text-paper hover:bg-brand-strong"
          >
            {t.retry}
          </button>
        </div>
      ) : results.length === 0 && state === "ready" ? (
        <div className="rounded-card border border-line bg-paper px-6 py-14 text-center">
          <div className="text-[16px] font-bold text-ink">
            {t.noneFor} «{query}»
          </div>
          <div className="mt-2 text-[14px] text-ink-3">{t.noneHint}</div>
          {section !== "all" && (
            <button
              onClick={() => setSection("all")}
              className="mt-5 rounded-pill border border-line px-5 py-2.5 text-[13.5px] font-bold text-ink hover:border-brand hover:text-brand"
            >
              {t.searchAllSections}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2 text-[14px] text-ink-3">
            <span className="tnum">
              {isAr ? toEasternNumerals(total) : total} {t.results}
            </span>
            {query ? (
              <span>
                {t.about} «{query}»
              </span>
            ) : null}
            {state === "loading" ? <span className="text-ink-3">· {t.searching}</span> : null}
          </div>

          <div className={`flex flex-col transition-opacity duration-fast ${state === "loading" ? "opacity-60" : ""}`}>
            {results.map((r) => (
              <div key={r.id} className="border-b border-line py-3">
                <ArticleCard
                  lang={lang}
                  variant="compact"
                  href={`${articleBase}/${r.slug}`}
                  title={r.title}
                  section={r.section_name}
                  time={relativeTime(r.published_at, lang)}
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
