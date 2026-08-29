"use client";

import Link from "next/link";
import { useState } from "react";

import CoverImage from "@/components/ui/CoverImage";

export type NewsCardItem = { href: string; title: string; imageSrc?: string | null };

const T = {
  ar: { latest: "أحدث الأخبار", mostRead: "الأكثر قراءة", drop: "" },
  en: { latest: "Latest News", mostRead: "Most Read", drop: "" },
};

/**
 * The client's reference: a solid red-headed card list, dropped in as the
 * very first thing after an article's own content — «أحدث الأخبار» is what
 * a reader lands on right after finishing a story, so it gets a heavier
 * visual anchor than the plain heading-and-list treatment the rest of the
 * site uses for a news feed.
 *
 * The two tabs share one header rather than becoming two stacked blocks —
 * the client's own "saves vertical space" reasoning. «أحدث الأخبار» opens
 * active, since that is what the header itself promises before anything is
 * clicked; «الأكثر قراءة» is a tap away rather than a second scroll, and
 * takes over the same red fill so "which list am I looking at" never needs
 * a caption.
 *
 * Each row is its OWN bordered, rounded box with a gap to its neighbours —
 * deliberately not a shared list with divider lines the way every other
 * list on the site renders a row (MostReadList, ArticleCard's compact/text
 * variants). This one component is allowed to look different because the
 * client's reference showed exactly this — a standalone card per item —
 * nowhere else on the site.
 */
export default function LatestNewsCard({
  lang,
  latest,
  mostRead,
}: {
  lang: "ar" | "en";
  latest: NewsCardItem[];
  mostRead: NewsCardItem[];
}) {
  const [tab, setTab] = useState<"latest" | "mostRead">("latest");
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const rows = tab === "latest" ? latest : mostRead;

  if (latest.length === 0 && mostRead.length === 0) return null;

  const tabClass = (active: boolean) =>
    `${fontDisplay} flex-1 px-4 py-3.5 text-[15px] font-extrabold transition-colors duration-fast ${
      active ? "bg-brand text-paper" : "bg-surface text-ink-2 hover:text-ink"
    }`;

  return (
    <section className="overflow-hidden rounded-card border border-line">
      <div className="flex">
        <button type="button" onClick={() => setTab("latest")} className={tabClass(tab === "latest")}>
          {t.latest}
        </button>
        <button type="button" onClick={() => setTab("mostRead")} className={tabClass(tab === "mostRead")}>
          {t.mostRead}
        </button>
      </div>
      <div className="flex flex-col gap-2.5 bg-surface p-3">
        {rows.map((r, i) => (
          <Link
            key={r.href + i}
            href={r.href}
            className="flex items-center gap-3 rounded-lg border border-line bg-paper p-2 no-underline transition-colors duration-fast hover:border-accent"
          >
            <span className="relative h-[52px] w-[72px] flex-shrink-0 overflow-hidden rounded-md">
              <CoverImage src={r.imageSrc} alt="" placeholder={t.drop} className="absolute inset-0" sizes="72px" />
            </span>
            <span className={`${fontDisplay} min-w-0 flex-1 text-[14px] font-bold leading-[1.5] text-ink`}>
              {r.title}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
