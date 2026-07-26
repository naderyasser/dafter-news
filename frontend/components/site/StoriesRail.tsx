import Link from "next/link";

import type { Story } from "@/lib/types";
import { mediaUrl } from "@/lib/api";

/**
 * Social-style stories strip: tall cards in a horizontally scrollable rail.
 *
 * Scrolling is native (overflow-x + scroll snap) rather than JS-driven so it
 * keeps working with a trackpad, a touch swipe, and keyboard focus — and it
 * reverses correctly in RTL for free.
 */
export default function StoriesRail({ lang, stories }: { lang: "ar" | "en"; stories: Story[] }) {
  if (!stories.length) return null;
  const isAr = lang === "ar";

  return (
    <section className="border-b border-line bg-paper py-5">
      <div className="mx-auto max-w-container px-6">
        <div className="mb-3 flex items-center justify-between">
          <h2
            className={`${isAr ? "font-display-ar" : "font-display-en"} border-s-[3px] border-brand ps-3 text-[17px] font-extrabold text-ink`}
          >
            {isAr ? "قصص اليوم" : "Today's stories"}
          </h2>
        </div>

        <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {stories.map((s) => {
            const img = mediaUrl(s.image);
            return (
              <Link
                key={s.id}
                href={s.href || "#"}
                className="group relative flex aspect-[9/16] w-[128px] flex-shrink-0 snap-start flex-col justify-end overflow-hidden rounded-card border-2 border-brand bg-navy-2 no-underline sm:w-[142px]"
              >
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-med group-hover:scale-105"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-navy via-[rgba(16,27,51,.35)] to-transparent" />
                <div className="relative p-2.5">
                  {s.section_name ? (
                    <div className="mb-1 text-[10.5px] font-bold text-brand-tint">{s.section_name}</div>
                  ) : null}
                  <div className="line-clamp-3 text-[12.5px] font-bold leading-[1.5] text-paper">{s.title}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
