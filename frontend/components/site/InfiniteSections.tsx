"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import Chevron from "@/components/ui/Chevron";
import CoverImage from "@/components/ui/CoverImage";
import ListThumb from "@/components/ui/ListThumb";
import { API_URL, mediaUrl } from "@/lib/api";
import { sectionColor } from "@/lib/sections";
import type { ArticleCard as ArticleCardType, Section } from "@/lib/types";

type Loaded = { section: Section; articles: ArticleCardType[] };

/**
 * One appended section, as a self-contained panel: a lead with its photo and
 * standfirst, and the rest as tight rows beside it.
 *
 * The reader has just finished an article, so what follows has to read as an
 * offer rather than as more inventory. Three identical cards in a row — what
 * this was — gave every story the same weight and, repeated down the page
 * for six sections, turned into wallpaper nobody scans. A lead plus two rows
 * has a shape: one thing to look at, two more to consider, and a heading
 * that says which desk they came from.
 *
 * Bordered and on paper so each panel is visibly one unit against the page's
 * grey, and the section's own colour carries the kicker and the rule — the
 * same identity the reader saw on the home page for that desk.
 */
function SectionPanel({
  lang,
  section,
  articles,
}: {
  lang: "ar" | "en";
  section: Section;
  articles: ArticleCardType[];
}) {
  const isAr = lang === "ar";
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const name = isAr ? section.name_ar : section.name_en || section.name_ar;
  const href = isAr ? `/section/${section.key}` : `/en/section/${section.key}`;
  const accent = sectionColor(section.key);
  // The English edition has its own article route; linking at /article/…
  // from it drops the reader into the Arabic page mid-read.
  const articleBase = isAr ? "/article" : "/en/article";
  const [lead, ...rest] = articles;
  if (!lead) return null;

  return (
    <section className="mx-auto max-w-container px-6 py-5">
      <div
        className="overflow-hidden rounded-card border border-line bg-paper"
        style={{ "--card-accent": accent } as React.CSSProperties}
      >
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
          <h2
            className={`${fontDisplay} rule-accent m-0 inline-block ps-3.5 text-[16px] font-extrabold text-ink`}
            style={{ "--rule-b": accent } as React.CSSProperties}
          >
            {name}
          </h2>
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-[13px] font-bold no-underline transition-opacity duration-fast hover:opacity-70"
            style={{ color: accent }}
          >
            {isAr ? "عرض الكل" : "See all"}
            <Chevron lang={lang} className="h-3 w-3" />
          </Link>
        </header>

        <div className="grid md:grid-cols-[1.35fr_1fr]">
          <Link href={`${articleBase}/${lead.slug}`} className="card-link block no-underline">
            <div className="relative aspect-[16/9] bg-surface-2">
              <CoverImage
                src={mediaUrl(lead.cover_image)}
                alt={lead.title}
                placeholder=""
                className="absolute inset-0"
                sizes="(min-width: 768px) 480px, 100vw"
              />
            </div>
            <div className="p-5">
              <h3 className={`${fontDisplay} card-title m-0 text-h3 font-bold leading-[1.5] text-ink`}>{lead.title}</h3>
              {lead.standfirst && (
                <p className="mt-2 line-clamp-2 text-[14px] leading-[1.7] text-ink-2">{lead.standfirst}</p>
              )}
            </div>
          </Link>

          {/* The two behind it. On a phone they stack under the lead with a
              hairline between; from md they become the panel's second column
              with a dividing edge, so the panel reads as one object at every
              width instead of two stacked lists. */}
          {rest.length > 0 && (
            <div className="flex flex-col divide-y divide-line border-t border-line md:border-s md:border-t-0">
              {rest.map((a) => (
                <Link
                  key={a.id}
                  href={`${articleBase}/${a.slug}`}
                  // flex-1 so three rows share the lead's height rather than
                  // stacking at the top of a column with nothing under them.
                  className="card-link flex flex-1 items-center gap-3.5 p-4 no-underline transition-colors duration-fast hover:bg-surface"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className={`${fontDisplay} card-title m-0 line-clamp-2 text-[14.5px] font-bold leading-[1.55] text-ink`}>
                      {a.title}
                    </h3>
                  </div>
                  <ListThumb src={mediaUrl(a.cover_image)} size="sm" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Continues the page past the end of an article by appending one site
 * section at a time as the reader approaches the bottom.
 *
 * This replaces the old sidebar, which ran out of content a screen into a
 * long article and left a dead rail for the rest of the scroll. Sections are
 * fetched lazily rather than all at once, so opening an article doesn't pay
 * for content most readers never reach.
 */
export default function InfiniteSections({
  lang,
  sections,
  excludeSlug,
}: {
  lang: "ar" | "en";
  sections: Section[];
  excludeSlug?: string;
}) {
  const isAr = lang === "ar";
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const cursor = useRef(0);

  const loadNext = useCallback(async () => {
    if (busy || done) return;
    const next = sections[cursor.current];
    if (!next) {
      setDone(true);
      return;
    }
    setBusy(true);
    cursor.current += 1;
    try {
      // `language=${lang}`, not a hardcoded "ar": on an English article this
      // was appending Arabic sections under English headings.
      // 5 fetched, 4 kept: the article being read is filtered out below, so
      // asking for exactly 4 would leave a panel one row short whenever the
      // reader is inside that section.
      const res = await fetch(
        `${API_URL}/articles/?language=${lang}&section__key=${next.key}&ordering=-published_at&page_size=5`,
      );
      if (res.ok) {
        const page = await res.json();
        const articles = (page.results as ArticleCardType[]).filter((a) => a.slug !== excludeSlug).slice(0, 4);
        // Skip empty sections rather than rendering a bare heading.
        if (articles.length) setLoaded((prev) => [...prev, { section: next, articles }]);
      }
    } catch {
      // Network hiccup — stop appending rather than looping on a dead fetch.
      setDone(true);
    } finally {
      setBusy(false);
    }
  }, [busy, done, sections, excludeSlug, lang]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadNext();
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadNext]);

  return (
    <>
      {loaded.map(({ section, articles }) => (
        <SectionPanel
          key={section.key}
          lang={lang}
          section={section}
          articles={articles}
        />
      ))}

      <div ref={sentinel} className="h-px" aria-hidden />

      {busy ? (
        <div className="mx-auto max-w-container px-6 py-5">
          {/* Same shape as the panel it precedes, so the page doesn't jump
              when the real one lands. */}
          <div className="animate-skeleton overflow-hidden rounded-card border border-line bg-paper">
            <div className="border-b border-line px-5 py-3.5">
              <div className="h-4 w-32 rounded bg-surface-2" />
            </div>
            <div className="grid md:grid-cols-[1.35fr_1fr]">
              <div>
                <div className="aspect-[16/9] bg-surface-2" />
                <div className="flex flex-col gap-2 p-5">
                  <div className="h-4 w-full rounded bg-surface-2" />
                  <div className="h-4 w-3/5 rounded bg-surface-2" />
                </div>
              </div>
              <div className="flex flex-col divide-y divide-line border-t border-line md:border-s md:border-t-0">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex gap-3.5 p-4">
                    <div className="aspect-square w-[64px] shrink-0 rounded-md bg-surface-2" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-full rounded bg-surface-2" />
                      <div className="h-3.5 w-2/3 rounded bg-surface-2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {done && loaded.length ? (
        <div className="mx-auto max-w-container px-6 pb-10 text-center">
          <Link
            href="/"
            className="inline-block rounded-pill border border-line bg-paper px-6 py-2.5 text-[14px] font-bold text-ink no-underline transition-colors duration-fast hover:border-brand hover:text-brand"
          >
            {isAr ? "العودة إلى الرئيسية" : "Back to home"}
          </Link>
        </div>
      ) : null}
    </>
  );
}
