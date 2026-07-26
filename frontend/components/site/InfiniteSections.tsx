"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import ArticleCard from "@/components/site/ArticleCard";
import SectionDivider from "@/components/site/SectionDivider";
import SectionHeading from "@/components/site/SectionHeading";
import { API_URL, mediaUrl } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import type { ArticleCard as ArticleCardType, Section } from "@/lib/types";

type Loaded = { section: Section; articles: ArticleCardType[] };

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
      const res = await fetch(`${API_URL}/articles/?section__key=${next.key}&ordering=-published_at&page_size=4`);
      if (res.ok) {
        const page = await res.json();
        const articles = (page.results as ArticleCardType[]).filter((a) => a.slug !== excludeSlug).slice(0, 3);
        // Skip empty sections rather than rendering a bare heading.
        if (articles.length) setLoaded((prev) => [...prev, { section: next, articles }]);
      }
    } catch {
      // Network hiccup — stop appending rather than looping on a dead fetch.
      setDone(true);
    } finally {
      setBusy(false);
    }
  }, [busy, done, sections, excludeSlug]);

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
        <div key={section.key}>
          <SectionDivider />
          <section className="mx-auto max-w-container px-6 py-6">
            <SectionHeading
              lang={lang}
              title={isAr ? section.name_ar : section.name_en || section.name_ar}
              href={`/section/${section.key}`}
            />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
              {articles.map((a) => (
                <ArticleCard
                  key={a.id}
                  lang={lang}
                  variant="standard"
                  href={`/article/${a.slug}`}
                  title={a.title}
                  section={a.section_name}
                  time={relativeTime(a.published_at, lang)}
                  badge={a.badge}
                  imageSrc={mediaUrl(a.cover_image)}
                />
              ))}
            </div>
          </section>
        </div>
      ))}

      <div ref={sentinel} className="h-px" aria-hidden />

      {busy ? (
        <div className="mx-auto max-w-container px-6 pb-8">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-skeleton rounded-card border border-line bg-paper">
                <div className="aspect-video rounded-t-card bg-surface-2" />
                <div className="flex flex-col gap-2 p-4">
                  <div className="h-3 w-1/3 rounded bg-surface-2" />
                  <div className="h-4 w-full rounded bg-surface-2" />
                  <div className="h-4 w-4/5 rounded bg-surface-2" />
                </div>
              </div>
            ))}
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
