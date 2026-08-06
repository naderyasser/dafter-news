"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { mediaUrl } from "@/lib/api";
import { paginateBlocks, parseInline, splitLongParagraph } from "@/lib/richtext";
import { toEasternNumerals } from "@/lib/format";
import type { ArticleBlock } from "@/lib/types";

/** Physical, not logical — the editor's alignment menu means "this literal
 *  side", the same as a word processor's, regardless of the article's own
 *  reading direction. */
const ALIGN_CLASS: Record<ArticleBlock["align"], string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
  justify: "text-justify",
};

/** Renders the editor's inline colour/bold/italic/underline markup as spans. See lib/richtext.ts. */
function Rich({ text }: { text: string }) {
  const segments = useMemo(() => parseInline(text), [text]);
  return (
    <>
      {segments.map((s, i) =>
        s.color || s.background || s.bold || s.italic || s.underline ? (
          <span
            key={i}
            style={{
              color: s.color,
              backgroundColor: s.background,
              fontWeight: s.bold ? 700 : undefined,
              fontStyle: s.italic ? "italic" : undefined,
              textDecoration: s.underline ? "underline" : undefined,
              // Highlights need room to breathe or the colour clips the
              // glyphs; text-only runs get neither padding nor a radius.
              ...(s.background ? { padding: "0.05em 0.25em", borderRadius: "3px" } : null),
            }}
          >
            {s.text}
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

export default function ArticleBlocks({ lang, blocks }: { lang: "ar" | "en"; blocks: ArticleBlock[] }) {
  const isAr = lang === "ar";
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const [page, setPage] = useState(0);

  /**
   * Long paragraphs are broken first, then the result is paginated — in that
   * order, so page sizes are measured against what the reader will actually
   * see rather than against the raw blocks.
   */
  const pages = useMemo(() => {
    const expanded = blocks.flatMap((b) =>
      b.type === "paragraph" && b.text
        ? splitLongParagraph(b.text).map((text, i) => ({ ...b, text, id: b.id * 1000 + i }))
        : [b],
    );
    return paginateBlocks(expanded);
  }, [blocks]);

  const paginated = pages.length > 1;
  const current = Math.min(page, pages.length - 1);

  const render = (b: ArticleBlock) => {
    if (b.type === "paragraph") {
      return (
        <p
          key={b.id}
          className={`mb-5 text-[clamp(1.125rem,1rem+0.3vw,1.1875rem)] leading-[1.95] text-ink ${ALIGN_CLASS[b.align]}`}
        >
          <Rich text={b.text} />
        </p>
      );
    }
    if (b.type === "heading") {
      return (
        <h2 key={b.id} className={`${fontDisplay} rule-accent mb-4 mt-8 ps-3.5 text-h2 font-extrabold text-ink`}>
          {b.text}
        </h2>
      );
    }
    if (b.type === "image") {
      const src = mediaUrl(b.image);
      return (
        <figure key={b.id} className="my-6">
          <div className="relative aspect-video overflow-hidden rounded-card bg-surface-2">
            {src ? (
              // Through the optimizer: in-body photos are uploaded at camera
              // size (the seed carries a 640KB one), and the reading column
              // is 680px wide — no reader needs the original.
              <Image src={src} alt={b.caption || ""} fill sizes="(min-width: 768px) 680px, 100vw" className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-caption font-semibold text-header-muted">
                {isAr ? "صورة داخل الخبر" : "Drop image here"}
              </div>
            )}
          </div>
          {b.caption && <figcaption className="mt-2 border-b border-line pb-4 text-caption text-ink-3">{b.caption}</figcaption>}
        </figure>
      );
    }
    if (b.type === "quote") {
      return (
        <blockquote key={b.id} className="rule-accent my-7 ps-5 text-[20px] font-semibold leading-[1.7] text-ink-2">
          <Rich text={b.text} />
        </blockquote>
      );
    }
    if (b.type === "related") {
      return (
        <Link
          key={b.id}
          href={b.related_article_slug ? `/article/${b.related_article_slug}` : "#"}
          className="my-6 flex flex-col gap-1.5 rounded-card bg-surface px-4.5 py-4 no-underline"
        >
          <span className="text-[13px] font-extrabold text-brand">{isAr ? "اقرأ أيضاً" : "Read also"}</span>
          <span className="text-[16px] font-bold leading-[1.5] text-ink">{b.text}</span>
        </Link>
      );
    }
    return null;
  };

  return (
    <>
      {/*
        Every page stays in the DOM and is hidden with the `hidden` attribute
        rather than unmounted. Unmounting would take the rest of the article
        out of the served HTML, which costs the search ranking and breaks
        in-page find — the reader gets short pages, crawlers still get the
        whole story.
      */}
      {pages.map((blocksOnPage, i) => (
        <div key={i} hidden={paginated && i !== current}>
          {blocksOnPage.map(render)}
        </div>
      ))}

      {paginated ? (
        <nav
          className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5"
          aria-label={isAr ? "صفحات المقال" : "Article pages"}
        >
          <button
            type="button"
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
            className="rounded-pill border border-line bg-paper px-4 py-2 text-[13.5px] font-semibold text-ink transition-colors duration-fast hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isAr ? "الصفحة السابقة" : "Previous page"}
          </button>

          <div className="flex items-center gap-1.5">
            {pages.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                aria-current={i === current}
                aria-label={`${isAr ? "صفحة" : "Page"} ${i + 1}`}
                className={`tnum flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-[13px] font-bold transition-colors duration-fast ${
                  i === current ? "border-accent bg-accent text-paper" : "border-line bg-paper text-ink hover:border-accent"
                }`}
              >
                {isAr ? toEasternNumerals(i + 1) : i + 1}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setPage(current + 1)}
            disabled={current === pages.length - 1}
            className="rounded-pill border border-line bg-paper px-4 py-2 text-[13.5px] font-semibold text-ink transition-colors duration-fast hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isAr ? "الصفحة التالية" : "Next page"}
          </button>
        </nav>
      ) : null}
    </>
  );
}
