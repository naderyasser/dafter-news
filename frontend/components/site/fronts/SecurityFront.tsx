import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";
import { dayBucket } from "@/lib/format";
import { sectionArtUrl } from "@/lib/sections";
import type { FrontProps } from "./types";

const T = {
  ar: { drop: "أفلت صورة الواقعة هنا", register: "سجل الوقائع", date: "التاريخ", empty: "لا وقائع مقيّدة بعد." },
  en: { drop: "Drop image here", register: "The register", date: "Date", empty: "Nothing on the register yet." },
};

/**
 * «أمن ومحاكم» — the register.
 *
 * Court and crime reporting is the one desk where a bright grid of photographs
 * is actively wrong: the pictures are of people mid-accusation, and sizing
 * them like festival coverage makes the page look like it is enjoying itself.
 *
 * So this front is a register. One lead under a solid bar, then a ruled ledger
 * where the filing date is a column of its own and the photographs are small
 * and desaturated — present as corroboration, not as spectacle. It is the
 * quietest page on the site by design, and it is the only one that opens on a
 * table rather than on an image.
 */
export default function SecurityFront({ lang, accent, sectionKey, title, tagline, stories }: FrontProps) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const art = sectionArtUrl(sectionKey, accent, 5);
  const accentVar = { "--card-accent": accent } as React.CSSProperties;
  const [lead, ...register] = stories;

  return (
    <>
      <header className="relative mb-7 border-t-[5px] pt-5" style={{ borderColor: accent }}>
        {art && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-[-25%] end-0 hidden w-[22%] bg-contain bg-center bg-no-repeat opacity-[.1] sm:block"
            style={{ backgroundImage: art }}
          />
        )}
        <h1 className={`${fontDisplay} relative m-0 text-[clamp(1.75rem,1.2rem+2.2vw,2.75rem)] font-extrabold leading-[1.2]`} style={{ color: accent }}>
          {title}
        </h1>
        {tagline && <p className="relative mt-2 max-w-[54ch] text-[15px] leading-[1.75] text-ink-2">{tagline}</p>}
      </header>

      {!lead && <p className="border-y border-line py-10 text-center text-[15px] text-ink-3">{t.empty}</p>}

      {/* A solid bar, not a gradient: the headline sits on the desk's colour
          below the photograph rather than being burned into it. */}
      {lead && (
        <Link href={lead.href} className="card-link mb-9 block no-underline" style={accentVar}>
          <article className="overflow-hidden rounded-card">
            <div className="relative aspect-[16/8]">
              <CoverImage
                src={lead.imageSrc}
                alt={lead.title}
                placeholder={t.drop}
                className="absolute inset-0 grayscale"
                sizes="(min-width: 1024px) 62vw, 100vw"
              />
            </div>
            <div className="px-5 py-5" style={{ backgroundColor: accent }}>
              <h2 className={`${fontDisplay} m-0 text-[clamp(1.125rem,.95rem+1.2vw,1.625rem)] font-extrabold leading-[1.45] text-paper`}>{lead.title}</h2>
              {lead.standfirst && <p className="mt-2 text-[14px] leading-[1.7] text-paper/85">{lead.standfirst}</p>}
              {lead.time && <div className="mt-2 text-[12px] font-semibold text-paper/70">{lead.time}</div>}
            </div>
          </article>
        </Link>
      )}

      {register.length > 0 && (
        <section>
          <h2 className={`${fontDisplay} m-0 border-b-2 pb-2 text-[15px] font-extrabold`} style={{ borderColor: accent, color: accent }}>
            {t.register}
          </h2>
          <ol className="m-0 list-none p-0">
            {register.map((s) => (
              <li key={s.id} className="border-b border-line">
                <Link href={s.href} className="card-link flex items-start gap-4 py-4 no-underline" style={accentVar}>
                  <time className="tnum w-[5.5rem] flex-shrink-0 border-e border-line pe-3 text-[12px] font-bold leading-[1.7] text-ink-3">
                    {dayBucket(s.iso, lang)}
                  </time>
                  <div className="min-w-0 flex-1">
                    <h3 className={`${fontDisplay} card-title m-0 text-[15px] font-extrabold leading-[1.65] text-ink sm:text-[16px]`}>{s.title}</h3>
                    {s.standfirst && <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.7] text-ink-2">{s.standfirst}</p>}
                  </div>
                  {s.imageSrc && (
                    <div className="relative hidden h-[54px] w-[54px] flex-shrink-0 overflow-hidden rounded-[3px] sm:block">
                      <CoverImage src={s.imageSrc} alt="" placeholder="" className="absolute inset-0 grayscale" sizes="54px" />
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
