import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";
import { sectionArtUrl } from "@/lib/sections";
import type { FrontProps, FrontStory } from "./types";

const T = {
  ar: { drop: "أفلت صورة الخبر هنا", other: "متفرقات", empty: "لا أخبار على هذا المكتب بعد.", jump: "على الطاولة اليوم" },
  en: { drop: "Drop image here", other: "In brief", empty: "Nothing on this desk yet.", jump: "On the desk today" },
};

const anchorId = (subject: string) => `subject-${encodeURIComponent(subject)}`;

/**
 * «عرب وعالم» — the wire.
 *
 * A foreign desk's stories answer "where" before they answer "what", which is
 * why every wire service in the world puts the dateline first. So does this
 * front: each item opens with its origin set in the desk's blue, an em dash,
 * then the headline — the shape a reader already knows from a news agency.
 *
 * Above the datelines, the desk's subjects (سياسة, اقتصاد, ثقافة) become the
 * page's sections, because this is the one desk that files against both a
 * place and a subject. Both fields are real columns on the article; neither is
 * invented to make the layout work, and a story missing one still renders —
 * it simply loses its dateline or files under «متفرقات».
 */
export default function WorldFront({ lang, accent, sectionKey, title, tagline, stories }: FrontProps) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const art = sectionArtUrl(sectionKey, accent, 5);
  const accentVar = { "--card-accent": accent } as React.CSSProperties;

  const [lead, ...others] = stories;

  const bySubject = new Map<string, FrontStory[]>();
  const unplaced: FrontStory[] = [];
  for (const s of others) {
    if (!s.subject) unplaced.push(s);
    else bySubject.set(s.subject, [...(bySubject.get(s.subject) ?? []), s]);
  }
  const blocks = [...bySubject.entries()];
  if (unplaced.length) blocks.push([t.other, unplaced]);

  const Dateline = ({ place }: { place?: string }) =>
    place ? (
      <>
        <span className="font-extrabold" style={{ color: accent }}>
          {place}
        </span>
        <span aria-hidden className="mx-1.5 text-ink-3">
          —
        </span>
      </>
    ) : null;

  return (
    <>
      {/* Masthead: the name sitting inside a stack of parallels — latitudes on
          a chart, and the ruled paper a wire used to arrive on. The lines run
          out to the open edge so the desk reads as looking outward. */}
      <header className="relative mb-7">
        {art && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-[-25%] end-[-1rem] hidden w-[22%] bg-contain bg-center bg-no-repeat opacity-[.09] sm:block"
            style={{ backgroundImage: art }}
          />
        )}
        <div className="relative flex items-center gap-4">
          <h1 className={`${fontDisplay} m-0 flex-shrink-0 text-[clamp(1.75rem,1.2rem+2.2vw,2.75rem)] font-extrabold leading-[1.2]`} style={{ color: accent }}>
            {title}
          </h1>
          <span aria-hidden className="flex min-w-0 flex-1 flex-col gap-[5px]">
            {[0.55, 0.35, 0.2, 0.12].map((o) => (
              <span key={o} className="block h-[2px]" style={{ backgroundColor: accent, opacity: o }} />
            ))}
          </span>
        </div>
        {tagline && <p className="relative mt-2.5 max-w-[54ch] text-[15px] leading-[1.75] text-ink-2">{tagline}</p>}
      </header>

      {blocks.length > 1 && (
        <nav aria-label={t.jump} className="mb-8 flex flex-wrap gap-2">
          {blocks.map(([subject]) => (
            <a
              key={subject}
              href={`#${anchorId(subject)}`}
              className="chip-fill rounded-pill border px-3.5 py-1.5 text-[13px] font-bold no-underline"
              style={{ borderColor: accent, color: accent, "--chip": accent } as React.CSSProperties}
            >
              {subject}
            </a>
          ))}
        </nav>
      )}

      {!lead && <p className="border-y border-line py-10 text-center text-[15px] text-ink-3">{t.empty}</p>}

      {/* The lead runs wide rather than tall: a foreign lead is usually one
          picture and a long headline, and stacking them wastes the fold. */}
      {lead && (
        <Link href={lead.href} className="card-link mb-9 block border-b border-line pb-8 no-underline" style={accentVar}>
          <article className="grid gap-6 sm:grid-cols-[1fr_1.1fr] sm:items-center">
            <div className="relative aspect-[16/10] overflow-hidden rounded-card">
              <CoverImage src={lead.imageSrc} alt={lead.title} placeholder={t.drop} className="absolute inset-0" sizes="(min-width: 768px) 45vw, 100vw" />
            </div>
            <div>
              <h2 className={`${fontDisplay} card-title m-0 text-[clamp(1.25rem,1rem+1.5vw,1.875rem)] font-extrabold leading-[1.45] text-ink`}>
                <Dateline place={lead.country} />
                {lead.title}
              </h2>
              {lead.standfirst && <p className="mt-2.5 text-[15px] leading-[1.75] text-ink-2">{lead.standfirst}</p>}
              {lead.time && <div className="mt-2.5 text-[13px] font-semibold text-ink-3">{lead.time}</div>}
            </div>
          </article>
        </Link>
      )}

      {blocks.map(([subject, items]) => (
        <section key={subject} id={anchorId(subject)} className="mb-9 scroll-mt-24">
          <h2 className="m-0 flex items-center gap-3 pb-3">
            <span className={`${fontDisplay} text-[15px] font-extrabold`} style={{ color: accent }}>
              {subject}
            </span>
            <span aria-hidden className="h-px flex-1" style={{ backgroundColor: accent, opacity: 0.22 }} />
          </h2>
          <div className="grid gap-x-7 gap-y-0 sm:grid-cols-2">
            {items.map((s) => (
              <Link key={s.id} href={s.href} className="card-link flex items-start gap-4 border-b border-line py-4 no-underline" style={accentVar}>
                <div className="min-w-0 flex-1">
                  <h3 className={`${fontDisplay} card-title m-0 text-[15px] font-extrabold leading-[1.65] text-ink`}>
                    <Dateline place={s.country} />
                    {s.title}
                  </h3>
                  {s.time && <div className="mt-1.5 text-[12px] font-semibold text-ink-3">{s.time}</div>}
                </div>
                {s.imageSrc && (
                  <div className="relative h-[58px] w-[80px] flex-shrink-0 overflow-hidden rounded-[3px]">
                    <CoverImage src={s.imageSrc} alt="" placeholder="" className="absolute inset-0" sizes="80px" />
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
