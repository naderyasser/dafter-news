import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";
import { toEasternNumerals } from "@/lib/format";
import type { Paginated, Video } from "@/lib/types";
import type { FrontProps } from "./types";

const T = {
  ar: { drop: "أفلت صورة الفيديو هنا", exclusive: "خاص", strip: "في العرض", empty: "لا مقاطع منشورة بعد.", comments: "تعليق" },
  en: { drop: "Drop still here", exclusive: "Exclusive", strip: "Now playing", empty: "Nothing published yet.", comments: "comments" },
};

/** The play glyph, drawn once and sized by its caller. */
function PlayMark({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`flex items-center justify-center rounded-full bg-[rgba(0,0,0,.55)] ring-1 ring-white/40 backdrop-blur-[2px] ${className}`}>
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-[45%] w-[45%] translate-x-[6%] text-paper">
        <path d="M8 5v14l11-7z" />
      </svg>
    </span>
  );
}

/**
 * «لقطة وتعليق» — the screening room.
 *
 * A video desk read on a white page is a shop window; read on black it is a
 * room with the lights down, which is what watching actually is. So this front
 * is the only near-black surface on the site, it runs the full width with no
 * rail beside it, and the feature still is given the whole stage before
 * anything else competes for attention.
 *
 * Everything below is a filmstrip: same crop, same rhythm, duration bottom
 * right the way every player in the world puts it. The consistency is the
 * point here — on this one desk a uniform grid is not laziness, it is the
 * contact sheet the medium is browsed in.
 *
 * The desk's own article table is empty by design (its stories live in the
 * video table), so this front takes the video feed and never the story list.
 */
export default function WatchFront({ lang, title, tagline, videos }: FrontProps & { videos?: Paginated<Video> | null }) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";

  // The video table holds Arabic titles only, so the English edition would
  // render an Arabic grid under an English masthead. Each edition takes the
  // clips written in its own script.
  const hasArabic = (s: string) => /[؀-ۿ]/.test(s);
  const items = (videos?.results ?? []).filter((v) => (isAr ? hasArabic(v.title) : !hasArabic(v.title)));

  // The stage needs a still. The newest clip is not always the one with a
  // poster on it, and a full-width empty slot at the top of a black page reads
  // as a broken player rather than as a clip awaiting artwork — so the newest
  // clip that HAS a still is featured, and the rest keep their order. If none
  // has one, the newest still leads: an empty stage beats no stage.
  const featureIndex = Math.max(0, items.findIndex((v) => v.cover_image));
  const feature = items[featureIndex];
  const strip = items.filter((_, i) => i !== featureIndex);

  return (
    <div className="overflow-hidden rounded-card bg-board-stage">
      <div className="px-5 py-7 sm:px-8 sm:py-9">
        <header className="mb-7">
          <h1 className={`${fontDisplay} m-0 text-[clamp(1.75rem,1.2rem+2.2vw,2.75rem)] font-extrabold leading-[1.2] text-paper`}>{title}</h1>
          {tagline && <p className="mt-2 max-w-[54ch] text-[15px] leading-[1.75] text-white/60">{tagline}</p>}
        </header>

        {!feature && <p className="py-10 text-center text-[15px] text-white/60">{t.empty}</p>}

        {feature && (
          <Link href={`/video/${feature.slug}`} className="group mb-9 block no-underline">
            <article>
              <div className="relative aspect-[16/9] overflow-hidden">
                <CoverImage src={feature.cover_image ?? undefined} alt={feature.title} placeholder={t.drop} className="absolute inset-0" placeholderClassName="bg-white/[.06] text-white/45" sizes="(min-width: 1024px) 1100px, 100vw" />
                <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.75),transparent_55%)]" />
                <PlayMark className="absolute start-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 sm:h-20 sm:w-20" />
                {feature.duration_label && (
                  <span className="tnum absolute bottom-3 end-3 rounded-badge bg-[rgba(0,0,0,.75)] px-2 py-1 text-[12px] font-bold text-paper">
                    {feature.duration_label}
                  </span>
                )}
                {feature.is_exclusive && (
                  <span className="absolute start-3 top-3 rounded-badge bg-badge-exclusive px-2 py-1 text-[11px] font-extrabold text-paper">{t.exclusive}</span>
                )}
              </div>
              <h2 className={`${fontDisplay} mt-4 text-[clamp(1.25rem,1rem+1.5vw,1.875rem)] font-extrabold leading-[1.45] text-paper transition-colors duration-fast group-hover:text-white/75`}>
                {feature.title}
              </h2>
            </article>
          </Link>
        )}

        {strip.length > 0 && (
          <section>
            <h2 className={`${fontDisplay} m-0 border-b border-white/15 pb-2.5 text-[14px] font-extrabold text-white/70`}>{t.strip}</h2>
            <div className="mt-5 grid gap-x-5 gap-y-7 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]">
              {strip.map((v) => (
                <Link key={v.id} href={`/video/${v.slug}`} className="group block no-underline">
                  <div className="relative aspect-video overflow-hidden">
                    <CoverImage src={v.cover_image ?? undefined} alt={v.title} placeholder={t.drop} className="absolute inset-0" placeholderClassName="bg-white/[.06] text-white/45" sizes="(min-width: 640px) 240px, 100vw" />
                    <div aria-hidden className="absolute inset-0 bg-black/0 transition-colors duration-fast group-hover:bg-black/25" />
                    <PlayMark className="absolute start-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-fast group-hover:opacity-100 group-focus-visible:opacity-100" />
                    {v.duration_label && (
                      <span className="tnum absolute bottom-2 end-2 rounded-badge bg-[rgba(0,0,0,.75)] px-1.5 py-0.5 text-[11px] font-bold text-paper">
                        {v.duration_label}
                      </span>
                    )}
                  </div>
                  <h3 className={`${fontDisplay} mt-2.5 line-clamp-2 text-[14px] font-extrabold leading-[1.6] text-paper transition-colors duration-fast group-hover:text-white/75`}>
                    {v.title}
                  </h3>
                  {v.comment_count > 0 && (
                    <div className="tnum mt-1.5 text-[11.5px] font-semibold text-white/50">
                      {isAr ? toEasternNumerals(v.comment_count) : v.comment_count} {t.comments}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
