"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import ArticleCard from "@/components/site/ArticleCard";
import Rich from "@/components/site/RichText";
import type { SectionBlockCard } from "@/components/site/SectionBlock";
import { mediaUrl } from "@/lib/api";
import { paginateBlocks, splitLongParagraph } from "@/lib/richtext";
import { toDisplayNumerals } from "@/lib/format";
import { articleHref } from "@/lib/routes";
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

/**
 * The client's «الأخبار ذات الصلة» ask, taken literally: related stories
 * shown IN the body's own white space, not only stacked below the byline's
 * manual «اقرأ أيضاً» block or in the end-of-article list. Placed at the
 * midpoint of the first page only — a paginated «ملف خاص» piece already gets
 * its own natural breaks between pages, so a second injected box there would
 * be redundant.
 */
function MidArticleRelated({ lang, cards }: { lang: "ar" | "en"; cards: SectionBlockCard[] }) {
  const isAr = lang === "ar";
  return (
    <aside className="my-7 rounded-card border border-line bg-surface p-4">
      <div className={`${isAr ? "font-display-ar" : "font-display-en"} rule-accent mb-3 ps-3.5 text-[13px] font-extrabold text-ink`}>
        {isAr ? "أخبار ذات صلة" : "Related news"}
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {cards.map((c, i) => (
          <ArticleCard
            key={c.href + i}
            lang={lang}
            variant="compact"
            href={c.href}
            title={c.title}
            badge={c.badge}
            imageSrc={c.imageSrc}
            kind={c.kind}
            authorAvatar={c.authorAvatar}
          />
        ))}
      </div>
    </aside>
  );
}

export default function ArticleBlocks({
  lang,
  blocks,
  relatedCards,
}: {
  lang: "ar" | "en";
  blocks: ArticleBlock[];
  /** Fed by the same /related/ call the end-of-article list uses; omitted
   *  (or empty) simply skips the inline box. */
  relatedCards?: SectionBlockCard[];
}) {
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
          className={`mb-5 whitespace-pre-wrap text-[clamp(1.125rem,1rem+0.3vw,1.1875rem)] leading-[1.95] text-ink ${ALIGN_CLASS[b.align]}`}
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
        <blockquote key={b.id} className="rule-accent my-7 whitespace-pre-wrap ps-5 text-[20px] font-semibold leading-[1.7] text-ink-2">
          <Rich text={b.text} />
        </blockquote>
      );
    }
    if (b.type === "related") {
      return (
        <Link
          key={b.id}
          href={
            b.related_article_slug
              ? articleHref({ kind: b.related_article_kind ?? "news", slug: b.related_article_slug }, lang)
              : "#"
          }
          className="my-6 flex flex-col gap-1.5 rounded-card bg-surface px-4.5 py-4 no-underline"
        >
          <span className="text-[13px] font-extrabold text-brand">{isAr ? "اقرأ أيضاً" : "Read also"}</span>
          <span className="text-[16px] font-bold leading-[1.5] text-ink">{b.text}</span>
        </Link>
      );
    }
    return null;
  };

  /**
   * Page 0's blocks, rendered, with the related-news box spliced into the
   * middle — never once per page, since it only ever runs on page 0.
   *
   * No minimum block count: this used to require >= 4 blocks, on the
   * reasoning that a shorter article has no real "middle white space" to
   * sit in. In practice most news briefs are one or two blocks, so that
   * skipped the box on the majority of the site's own articles — a reader
   * (and the client testing it) only ever saw it on long features, and
   * everywhere else the box was pushed all the way down to the
   * end-of-article list, after the comments, which is exactly the
   * placement the client asked NOT to have. splice() at the midpoint
   * degrades sensibly for any length: on a single-block article
   * `Math.ceil(1/2) = 1` inserts right after that one block — still
   * "inside the article's own content," never below the comment thread.
   */
  const renderPage = (blocksOnPage: ArticleBlock[], pageIndex: number) => {
    const nodes = blocksOnPage.map(render);
    if (pageIndex === 0 && relatedCards && relatedCards.length > 0) {
      nodes.splice(Math.ceil(blocksOnPage.length / 2), 0, <MidArticleRelated key="mid-article-related" lang={lang} cards={relatedCards} />);
    }
    return nodes;
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
          {renderPage(blocksOnPage, i)}
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
                {isAr ? toDisplayNumerals(i + 1) : i + 1}
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
