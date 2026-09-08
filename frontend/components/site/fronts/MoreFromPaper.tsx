import Link from "next/link";

import ListThumb from "@/components/ui/ListThumb";
import type { FrontStory } from "./types";

const T = {
  ar: { heading: "أحدث ما نشرناه", drop: "" },
  en: { heading: "Latest from the paper", drop: "" },
};

/**
 * The foot of a quiet desk.
 *
 * Some desks file one story a week. Their front is built for a full news day,
 * so on a thin one the column runs out above the sidebar beside it and the
 * page reads as broken rather than as quiet — «سياسة» currently ends 576px
 * down, shorter than its own «الأكثر قراءة» rail.
 *
 * The honest fix is not to pad the desk with filler dressed up as its own
 * coverage. It is to say plainly that this is the rest of the paper, and give
 * a reader who reached the end of a short desk somewhere to go. So this block
 * is deliberately neutral: it carries no section colour and none of the desk's
 * structural device, because it is not part of that desk — it is the paper.
 *
 * Only rendered below a threshold (see SectionFrontBody). A desk with a full
 * day of news never shows it, which is the point.
 */
export default function MoreFromPaper({ lang, items }: { lang: "ar" | "en"; items: FrontStory[] }) {
  const t = T[lang];
  const fontDisplay = lang === "ar" ? "font-display-ar" : "font-display-en";
  if (!items.length) return null;

  return (
    <section className="mt-12 border-t-2 border-line-strong pt-5">
      <h2 className={`${fontDisplay} m-0 mb-4 text-[14px] font-extrabold text-ink-3`}>{t.heading}</h2>
      <div className="grid gap-x-6 gap-y-0 sm:grid-cols-2">
        {items.map((s) => (
          <Link key={s.id} href={s.href} className="card-link flex items-start gap-3.5 border-b border-line py-3.5 no-underline">
            <div className="min-w-0 flex-1">
              <h3 className={`${fontDisplay} card-title m-0 text-[14.5px] font-extrabold leading-[1.6] text-ink`}>{s.title}</h3>
              <div className="mt-1 flex items-center gap-2 text-[12px] text-ink-3">
                {s.section && <span className="font-bold">{s.section}</span>}
                {s.section && s.time && <span aria-hidden>·</span>}
                {s.time && <span>{s.time}</span>}
              </div>
            </div>
            {s.imageSrc && <ListThumb src={s.imageSrc} size="sm" placeholder={t.drop} />}
          </Link>
        ))}
      </div>
    </section>
  );
}
