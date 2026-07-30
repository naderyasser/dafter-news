import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";
import { withoutSectionPrefix } from "@/lib/format";
import { sectionArtUrl } from "@/lib/sections";
import type { FrontProps } from "./types";

const T = {
  ar: { drop: "أفلت صورة الدليل هنا", answer: "الخلاصة", empty: "لا أدلة على هذا المكتب بعد." },
  en: { drop: "Drop image here", answer: "In short", empty: "Nothing on this desk yet." },
};

/**
 * «دليلك الأول» — the answer desk.
 *
 * Service journalism is read with a question already in mind: how do I renew
 * it, when does it open, what does it cost. A reader scanning for their own
 * question needs headlines they can sweep in one column and an answer visible
 * without opening anything.
 *
 * So each entry is a question with its answer set beneath it in an indented
 * block behind an amber rule — the shape of a reference book, not of a news
 * feed. Entries run in one wide measure rather than a grid, because comparing
 * two guides side by side is not something anyone does.
 *
 * A guide with nothing but a headline simply shows the headline; the answer
 * block appears only where an editor actually wrote a distinct standfirst,
 * which is why it is never a repeat of the line above it.
 */
export default function GuideFront({ lang, accent, sectionKey, title, tagline, stories }: FrontProps) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const art = sectionArtUrl(sectionKey, accent, 5);
  const accentVar = { "--card-accent": accent } as React.CSSProperties;
  const [lead, ...rest] = stories;

  return (
    <>
      {/* Masthead: the compass at reading size beside the name, on a tinted
          panel behind a thick rule at the inline start. A service desk should
          look like a signpost, so the mark is an icon a reader can actually
          see rather than a watermark ghosted behind the type. */}
      <header className="relative mb-8 flex items-center gap-5 border-s-[6px] bg-paper px-5 py-5" style={{ borderColor: accent }}>
        {art && (
          // 20:12 — the marks are drawn on a 200×120 canvas, so a square box
          // would letterbox the compass down to a smudge.
          <span
            aria-hidden
            className="hidden h-12 w-20 flex-shrink-0 bg-contain bg-center bg-no-repeat sm:block"
            style={{ backgroundImage: art }}
          />
        )}
        <div className="min-w-0">
          <h1 className={`${fontDisplay} m-0 text-[clamp(1.625rem,1.2rem+1.8vw,2.5rem)] font-extrabold leading-[1.2]`} style={{ color: accent }}>
            {title}
          </h1>
          {tagline && <p className="mt-1.5 max-w-[54ch] text-[15px] leading-[1.75] text-ink-2">{tagline}</p>}
        </div>
      </header>

      {!lead && <p className="border-y border-line py-10 text-center text-[15px] text-ink-3">{t.empty}</p>}

      {lead && (
        <Link href={lead.href} className="card-link mb-9 block no-underline" style={accentVar}>
          <article>
            <div className="relative aspect-[16/7] overflow-hidden rounded-card">
              <CoverImage src={lead.imageSrc} alt={lead.title} placeholder={t.drop} className="absolute inset-0" sizes="(min-width: 1024px) 62vw, 100vw" />
            </div>
            <h2 className={`${fontDisplay} card-title mt-4 text-[clamp(1.25rem,1rem+1.5vw,1.875rem)] font-extrabold leading-[1.4] text-ink`}>{withoutSectionPrefix(lead.title, title)}</h2>
            {lead.standfirst && (
              <p className="mt-3 border-s-[3px] ps-4 text-[15px] leading-[1.8] text-ink-2" style={{ borderColor: accent }}>
                <span className="font-extrabold" style={{ color: accent }}>
                  {t.answer}:{" "}
                </span>
                {lead.standfirst}
              </p>
            )}
            {lead.time && <div className="mt-2.5 text-[13px] font-semibold text-ink-3">{lead.time}</div>}
          </article>
        </Link>
      )}

      {rest.length > 0 && (
        <div>
          {rest.map((s) => (
            <Link key={s.id} href={s.href} className="card-link flex items-start gap-5 border-t border-line py-6 no-underline" style={accentVar}>
              {s.imageSrc && (
                <div className="relative hidden h-[88px] w-[88px] flex-shrink-0 overflow-hidden rounded-card sm:block">
                  <CoverImage src={s.imageSrc} alt="" placeholder="" className="absolute inset-0" sizes="88px" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className={`${fontDisplay} card-title m-0 text-[17px] font-extrabold leading-[1.55] text-ink`}>{withoutSectionPrefix(s.title, title)}</h3>
                {s.standfirst && (
                  <p className="mt-2.5 border-s-[3px] ps-3.5 text-[14px] leading-[1.8] text-ink-2" style={{ borderColor: accent }}>
                    <span className="font-extrabold" style={{ color: accent }}>
                      {t.answer}:{" "}
                    </span>
                    {s.standfirst}
                  </p>
                )}
                {s.time && <div className="mt-2 text-[12px] font-semibold text-ink-3">{s.time}</div>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
