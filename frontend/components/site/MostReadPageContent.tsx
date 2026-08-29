"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { toEasternNumerals } from "@/lib/format";

/** Same caption rule as the sidebar widget — section only, no read count.
 *  See MostReadItem for why. */
export type MostReadRow = { title: string; section: string; href: string; views?: number; imageSrc?: string };

const PERIODS = [
  { key: "day", label: "اليوم" },
  { key: "week", label: "الأسبوع" },
  { key: "month", label: "الشهر" },
] as const;

export default function MostReadPageContent({ rows }: { rows: MostReadRow[] }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("day");

  // The API only tracks a single lifetime view counter per article — there is
  // no per-day/week/month breakdown to rank against. Reshuffling `rows`
  // locally (reversing it for "week", rotating it for "month") would present
  // a fabricated ranking under a period label that implies real data, so
  // every period shows the same real ranking until the backend can serve
  // period-scoped counts.
  const ordered = rows;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rule-accent ps-4">
        <h1 className="font-display-ar m-0 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)] font-extrabold text-ink">الأكثر قراءة</h1>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-pill border px-4 py-2 text-[13px] font-semibold ${
                period === p.key ? "border-brand bg-brand text-paper" : "border-line bg-paper text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] gap-x-8 gap-y-2">
        {ordered.map((it, i) => (
          <Link key={it.href + i} href={it.href} className="flex items-start gap-3.5 border-b border-line py-4 no-underline">
            <span className="tnum min-w-[34px] flex-shrink-0 text-[30px] font-extrabold leading-none text-brand">
              {toEasternNumerals(i + 1)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[15px] font-semibold leading-[1.5] text-ink">{it.title}</span>
              <span className="tnum flex flex-wrap items-center gap-x-1.5 text-xs text-ink-3">{it.section}</span>
            </span>
            {/* The homepage widget carries these thumbs, and this page —
                the widget's own «عرض الكل» destination — showed bare text,
                which read as the images failing rather than as a design.
                Same placement rule as the widget: rank at the start is the
                reading anchor, photo at the inline end. */}
            {it.imageSrc ? (
              <Image
                src={it.imageSrc}
                alt=""
                width={96}
                height={72}
                sizes="96px"
                className="h-[72px] w-[96px] flex-shrink-0 rounded object-cover"
              />
            ) : (
              <span className="h-[72px] w-[96px] flex-shrink-0 rounded bg-surface-2" aria-hidden />
            )}
          </Link>
        ))}
      </div>
    </>
  );
}
