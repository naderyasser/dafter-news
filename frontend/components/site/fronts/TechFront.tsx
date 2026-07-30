import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";
import { formatDate } from "@/lib/format";
import { sectionArtUrl, sectionColorOnDark } from "@/lib/sections";
import type { FrontProps } from "./types";

const T = {
  ar: { drop: "أفلت صورة الموضوع هنا", empty: "لا موضوعات على هذا المكتب بعد." },
  en: { drop: "Drop image here", empty: "Nothing on this desk yet." },
};

/**
 * «علوم وتكنولوجيا» — the board.
 *
 * The one desk whose subject is natively read on a dark screen, so this is the
 * one front that is dark all the way down rather than paper with a dark strip.
 * The surface carries a faint measured grid — a drafting sheet, an oscilloscope
 * face — drawn with two repeating gradients so it costs nothing and stays crisp
 * at any zoom.
 *
 * Photography is inset inside panels with a hairline rather than bled to the
 * edges: on this desk the picture is usually a diagram or a device shot, and
 * framing it reads as an exhibit instead of as a mood image.
 *
 * The cyan is the section's own, lifted for the dark surface — see
 * sectionColorOnDark. The paper-tuned value reads at 3.34:1 here.
 */
export default function TechFront({ lang, sectionKey, title, tagline, stories }: FrontProps) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const glow = sectionColorOnDark(sectionKey);
  const art = sectionArtUrl(sectionKey, glow, 5);
  const [lead, ...rest] = stories;

  return (
    <div className="overflow-hidden rounded-card bg-board">
      {/* 32px drafting grid. Two gradients, no image request. */}
      <div
        className="relative bg-[length:32px_32px] bg-[image:repeating-linear-gradient(0deg,rgba(255,255,255,.045)_0_1px,transparent_1px_32px),repeating-linear-gradient(90deg,rgba(255,255,255,.045)_0_1px,transparent_1px_32px)] px-5 py-7 sm:px-7"
      >
        <header className="relative mb-7 border-t-[3px] pt-5" style={{ borderColor: glow }}>
          {art && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-[-30%] end-0 hidden w-[24%] bg-contain bg-center bg-no-repeat opacity-[.18] sm:block"
              style={{ backgroundImage: art }}
            />
          )}
          <h1 className={`${fontDisplay} relative m-0 text-[clamp(1.75rem,1.2rem+2.2vw,2.75rem)] font-extrabold leading-[1.2]`} style={{ color: glow }}>
            {title}
          </h1>
          {tagline && <p className="relative mt-2 max-w-[54ch] text-[15px] leading-[1.75] text-header-muted">{tagline}</p>}
        </header>

        {!lead && <p className="py-10 text-center text-[15px] text-header-muted">{t.empty}</p>}

        {lead && (
          <Link
            href={lead.href}
            className="mb-6 block border bg-[rgba(255,255,255,.03)] p-3 no-underline transition-colors duration-fast hover:bg-[rgba(255,255,255,.06)] focus-visible:bg-[rgba(255,255,255,.06)]"
            style={{ borderColor: `${glow}59` }}
          >
            <article className="grid gap-5 sm:grid-cols-[1.25fr_1fr] sm:items-center">
              <div className="relative aspect-[16/10] overflow-hidden">
                <CoverImage src={lead.imageSrc} alt={lead.title} placeholder={t.drop} className="absolute inset-0" placeholderClassName="bg-white/[.06] text-white/45" sizes="(min-width: 768px) 48vw, 100vw" />
              </div>
              <div className="px-1 pb-2 sm:pb-0">
                <h2 className={`${fontDisplay} m-0 text-[clamp(1.25rem,1rem+1.4vw,1.75rem)] font-extrabold leading-[1.45] text-paper`}>{lead.title}</h2>
                {lead.standfirst && <p className="mt-2 text-[15px] leading-[1.75] text-header-muted">{lead.standfirst}</p>}
                <div className="tnum mt-3 text-[12px] font-bold" style={{ color: glow }}>
                  {formatDate(lead.iso, lang) || lead.time}
                </div>
              </div>
            </article>
          </Link>
        )}

        {rest.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {rest.map((s) => (
              <Link
                key={s.id}
                href={s.href}
                className="block border bg-[rgba(255,255,255,.03)] p-3 no-underline transition-colors duration-fast hover:bg-[rgba(255,255,255,.06)] focus-visible:bg-[rgba(255,255,255,.06)]"
                style={{ borderColor: `${glow}40` }}
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  <CoverImage src={s.imageSrc} alt={s.title} placeholder={t.drop} className="absolute inset-0" placeholderClassName="bg-white/[.06] text-white/45" sizes="(min-width: 768px) 300px, 100vw" />
                </div>
                <h3 className={`${fontDisplay} mt-3 px-1 text-[16px] font-extrabold leading-[1.6] text-paper`}>{s.title}</h3>
                {s.standfirst && <p className="mt-1.5 line-clamp-2 px-1 text-[13px] leading-[1.7] text-header-muted">{s.standfirst}</p>}
                <div className="tnum mt-2 px-1 pb-1 text-[11.5px] font-bold" style={{ color: glow }}>
                  {formatDate(s.iso, lang) || s.time}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
