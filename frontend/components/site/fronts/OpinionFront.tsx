import Link from "next/link";

import { formatDate } from "@/lib/format";
import { sectionArtUrl } from "@/lib/sections";
import type { FrontProps, FrontStory } from "./types";

const T = {
  ar: { empty: "لا مقالات رأي منشورة بعد." },
  en: { empty: "No columns published yet." },
};

/**
 * «بالعقل والمنطق» — the op-ed page.
 *
 * An opinion page sells the writer before it sells the piece: a reader comes
 * back for a voice they trust, so the portrait and the name come first and the
 * argument is set as the writer's own words rather than as a headline over a
 * news photograph. There are no news pictures on this front at all.
 *
 * The desk runs without the «الأكثر قراءة» rail beside it (see
 * lib/sectionLayout) — ranking columns by popularity next to a page of
 * argument is an editorial position nobody chose.
 */
function Portrait({ story, size, accent }: { story: FrontStory; size: number; accent: string }) {
  const style = { width: size, height: size, borderColor: accent, color: accent };
  return (
    <span
      className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-surface-2 font-extrabold"
      style={{ ...style, fontSize: Math.round(size / 2.6) }}
    >
      {story.authorAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={story.authorAvatar} alt={story.authorName || ""} className="h-full w-full object-cover" />
      ) : (
        story.authorInitial || "؟"
      )}
    </span>
  );
}

export default function OpinionFront({ lang, accent, sectionKey, title, tagline, stories }: FrontProps) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const art = sectionArtUrl(sectionKey, accent, 5);
  const accentVar = { "--card-accent": accent } as React.CSSProperties;
  const [lead, ...rest] = stories;

  return (
    <>
      <header className="relative mb-10 overflow-hidden rounded-card px-6 py-6 sm:px-9 sm:py-7" style={{ backgroundColor: accent }}>
        {art && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-[-25%] end-[-1rem] hidden w-[26%] bg-contain bg-center bg-no-repeat opacity-20 sm:block"
            style={{ backgroundImage: art }}
          />
        )}
        <h1 className={`${fontDisplay} relative m-0 text-[clamp(1.875rem,1.3rem+2.4vw,3rem)] font-extrabold leading-[1.2] text-paper`}>{title}</h1>
        {tagline && <p className="relative mt-2.5 max-w-[52ch] text-[15px] leading-[1.75] text-paper/85">{tagline}</p>}
      </header>

      {!lead && <p className="border-y border-line py-10 text-center text-[15px] text-ink-3">{t.empty}</p>}

      {/* The lead column: the writer, then the argument in their own size. */}
      {lead && (
        <Link href={lead.href} className="card-link mx-auto mb-12 block max-w-[720px] no-underline" style={accentVar}>
          <article className="text-center">
            <span className="mx-auto flex w-fit flex-col items-center gap-3">
              <Portrait story={lead} size={92} accent={accent} />
              {lead.authorName && (
                <span className="text-[15px] font-extrabold" style={{ color: accent }}>
                  {lead.authorName}
                </span>
              )}
            </span>
            {/* The opening guillemet points into the text, so it is » in Arabic
                and « in English — the same mark mirrored, not a different one. */}
            <span aria-hidden className={`${fontDisplay} mt-6 block text-[64px] font-extrabold leading-[0.35]`} style={{ color: accent, opacity: 0.28 }}>
              {isAr ? "»" : "«"}
            </span>
            <h2 className={`${fontDisplay} card-title mt-3 text-[clamp(1.375rem,1.05rem+1.8vw,2.125rem)] font-extrabold leading-[1.45] text-ink`}>
              {lead.title}
            </h2>
            {lead.standfirst && <p className="mx-auto mt-3 max-w-[52ch] text-[15px] leading-[1.85] text-ink-2">{lead.standfirst}</p>}
            <div className="mt-4 text-[13px] font-semibold text-ink-3">{formatDate(lead.iso, lang) || lead.time}</div>
          </article>
        </Link>
      )}

      {/* Two columns only once there are two columns' worth. A lone second
          column left the single remaining writer stranded in one half of the
          page with the other half empty — which read as a layout fault, not as
          a quiet week. */}
      {rest.length > 0 && (
        <div className={`grid gap-x-9 gap-y-8 border-t border-line pt-9 ${rest.length > 1 ? "sm:grid-cols-2" : "mx-auto max-w-[620px]"}`}>
          {rest.map((s) => (
            <Link key={s.id} href={s.href} className="card-link block no-underline" style={accentVar}>
              <article className="flex gap-4">
                <Portrait story={s} size={54} accent={accent} />
                <div className="min-w-0 flex-1">
                  {s.authorName && (
                    <span className="text-[13px] font-extrabold" style={{ color: accent }}>
                      {s.authorName}
                    </span>
                  )}
                  <h3 className={`${fontDisplay} card-title mt-1.5 text-[17px] font-extrabold leading-[1.55] text-ink`}>{s.title}</h3>
                  {s.standfirst && <p className="mt-2 line-clamp-3 text-[14px] leading-[1.75] text-ink-2">{s.standfirst}</p>}
                  <div className="mt-2 text-[12px] font-semibold text-ink-3">{formatDate(s.iso, lang) || s.time}</div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
