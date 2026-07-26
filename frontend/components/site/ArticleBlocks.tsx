import Link from "next/link";

import { mediaUrl } from "@/lib/api";
import type { ArticleBlock } from "@/lib/types";

export default function ArticleBlocks({ lang, blocks }: { lang: "ar" | "en"; blocks: ArticleBlock[] }) {
  const isAr = lang === "ar";
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  return (
    <>
      {blocks.map((b) => {
        if (b.type === "paragraph") {
          return (
            <p key={b.id} className="mb-5 text-[clamp(1.125rem,1rem+0.3vw,1.1875rem)] leading-[1.95] text-ink">
              {b.text}
            </p>
          );
        }
        if (b.type === "heading") {
          return (
            <h2 key={b.id} className={`${fontDisplay} mb-4 mt-8 border-s-[3px] border-brand ps-3.5 text-h2 font-extrabold text-ink`}>
              {b.text}
            </h2>
          );
        }
        if (b.type === "image") {
          const src = mediaUrl(b.image);
          return (
            <figure key={b.id} className="my-6">
              <div className="aspect-video overflow-hidden rounded-card bg-surface-2">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={b.caption || ""} className="h-full w-full object-cover" />
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
            <blockquote key={b.id} className="my-7 border-s-[3px] border-brand ps-5 text-[20px] font-semibold leading-[1.7] text-ink-2">
              {b.text}
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
      })}
    </>
  );
}
