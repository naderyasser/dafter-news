"use client";

import Link from "next/link";
import { useRef } from "react";

export type OpinionItem = { name: string; quote: string; href: string; initial: string };

export default function OpinionCarousel({
  lang,
  items,
  seeAllHref,
}: {
  lang: "ar" | "en";
  items: OpinionItem[];
  seeAllHref: string;
}) {
  const isAr = lang === "ar";
  const fontBody = isAr ? "font-body-ar" : "font-body-en";
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: 320 * dir * (isAr ? -1 : 1), behavior: "smooth" });
  };

  return (
    <section className={`${fontBody} bg-header-bg py-10`}>
      <div className="mx-auto mb-5 flex max-w-container flex-wrap items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-4">
          <span className={`${fontDisplay} border-s-[3px] border-brand ps-3 text-h2 font-extrabold text-paper`}>
            {isAr ? "بالعقل والمنطق" : "By Reason & Logic"}
          </span>
          <a href={seeAllHref} className="text-[13px] text-header-muted no-underline hover:text-paper">
            {isAr ? "عرض الكل" : "See all"}
          </a>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => scroll(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-2 bg-transparent text-[15px] text-paper hover:border-brand hover:bg-brand"
          >
            ‹
          </button>
          <button
            onClick={() => scroll(1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-2 bg-transparent text-[15px] text-paper hover:border-brand hover:bg-brand"
          >
            ›
          </button>
        </div>
      </div>
      <div ref={ref} className="mx-auto flex max-w-container gap-4 overflow-x-auto scroll-smooth px-6">
        {items.map((op, i) => (
          <Link
            key={op.href + i}
            href={op.href}
            className="flex w-[300px] flex-shrink-0 flex-col gap-3.5 rounded-card bg-[#1B1F26] p-6 no-underline"
          >
            <span className="font-serif text-[40px] font-extrabold leading-[.6] text-brand">&ldquo;</span>
            <div className="flex-1 text-[16px] font-semibold leading-[1.6] text-paper">{op.quote}</div>
            <div className="mt-2 flex items-center gap-2.5">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-brand bg-[#2A2F37] text-[15px] font-extrabold text-header-ink">
                {op.initial}
              </div>
              <span className="text-[13px] text-header-muted">{op.name}</span>
              <span className={`ms-auto text-[18px] text-brand ${isAr ? "-scale-x-100" : ""}`}>→</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
