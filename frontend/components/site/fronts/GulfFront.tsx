import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";
import { sectionArtUrl } from "@/lib/sections";
import type { FrontProps, FrontStory } from "./types";

const T = {
  ar: { drop: "أفلت صورة الخبر هنا", empty: "لا أخبار على هذا المكتب بعد." },
  en: { drop: "Drop image here", empty: "Nothing on this desk yet." },
};

/**
 * One card: photo, the story's own country as a pill riding its corner, then
 * the headline set below on paper rather than over the image. `size` only
 * changes scale — the shape stays the same top to bottom of the feed, which
 * is what makes the feed read as one flow rather than a lead-plus-afterthought.
 */
function Card({ s, accent, lang, size }: { s: FrontStory; accent: string; lang: "ar" | "en"; size: "lg" | "sm" }) {
  const t = T[lang];
  const isAr = lang === "ar";
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const isLg = size === "lg";
  const accentVar = { "--card-accent": accent } as React.CSSProperties;

  return (
    <Link href={s.href} className="card-link block no-underline" style={accentVar}>
      <div className={`relative overflow-hidden rounded-card ${isLg ? "aspect-[16/11]" : "aspect-[4/3]"}`}>
        <CoverImage
          src={s.imageSrc}
          alt={s.title}
          placeholder={t.drop}
          className="absolute inset-0"
          sizes={isLg ? "(min-width: 640px) 640px, 100vw" : "(min-width: 640px) 300px, 50vw"}
        />
        {s.country && (
          <span
            className="absolute bottom-3 end-3 z-10 rounded-badge px-2.5 py-1 text-[11px] font-extrabold text-paper"
            style={{ backgroundColor: accent }}
          >
            {s.country}
          </span>
        )}
      </div>
      <h3
        className={`${fontDisplay} card-title m-0 mt-3 font-extrabold leading-[1.5] text-ink ${
          isLg ? "text-[clamp(1.1rem,.95rem+.6vw,1.4rem)]" : "text-[14px] leading-[1.6]"
        }`}
      >
        {s.title}
      </h3>
      {s.time && <div className={`mt-1.5 font-semibold text-ink-3 ${isLg ? "text-[12.5px]" : "text-[11.5px]"}`}>{s.time}</div>}
    </Link>
  );
}

/**
 * «الخليج العربي» — the feed.
 *
 * Replaces the old board-of-capitals layout: the client forwarded a plain
 * home-style feed and asked for this desk to read the same way — a photo,
 * its own dateline riding the corner, the headline set below rather than
 * over the picture, big cards up top thinning into a two-column grid. The
 * per-card country pill is what the board's columns used to do (place the
 * story by capital) without needing a column to do it in.
 */
export default function GulfFront({ lang, accent, sectionKey, title, tagline, stories }: FrontProps) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const art = sectionArtUrl(sectionKey, "rgba(255,255,255,.95)", 5);

  const large = stories.slice(0, 2);
  const rest = stories.slice(2);

  return (
    <>
      <header className="relative mb-8 overflow-hidden rounded-card" style={{ backgroundColor: accent }}>
        {art && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-[-15%] end-[-1rem] hidden w-[30%] bg-contain bg-center bg-no-repeat opacity-[.18] sm:block"
            style={{ backgroundImage: art }}
          />
        )}
        <div className="relative px-5 py-6 sm:px-7">
          <h1 className={`${fontDisplay} m-0 text-[clamp(1.75rem,1.2rem+2.2vw,2.75rem)] font-extrabold leading-[1.2] text-paper`}>{title}</h1>
          {tagline && <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.7] text-paper/85">{tagline}</p>}
        </div>
      </header>

      {stories.length === 0 && <p className="border-y border-line py-10 text-center text-[15px] text-ink-3">{t.empty}</p>}

      {large.length > 0 && (
        <div className="mb-8 flex flex-col gap-8">
          {large.map((s) => (
            <Card key={s.id} s={s} accent={accent} lang={lang} size="lg" />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3">
          {rest.map((s) => (
            <Card key={s.id} s={s} accent={accent} lang={lang} size="sm" />
          ))}
        </div>
      )}
    </>
  );
}
