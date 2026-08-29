import OpinionCard from "@/components/site/OpinionCard";
import { sectionArtUrl } from "@/lib/sections";
import type { FrontProps } from "./types";

const T = {
  ar: { empty: "لا مقالات رأي منشورة بعد." },
  en: { empty: "No columns published yet." },
};

/**
 * «بالعقل والمنطق» — the op-ed page.
 *
 * The desk's masthead stays its own accent-coloured band, same as every
 * other section front. Below it, the body is a full grid of the same
 * white/red "quote card" the homepage's own opinion carousel uses (see
 * OpinionCard) — the client's ask, after the section front's earlier
 * portrait-lead layout read as a different, unrelated design from the one
 * readers already recognise from the homepage. One card component, used
 * wherever this desk's writers are listed: here, and on /opinion.
 *
 * The desk runs without the «الأكثر قراءة» rail beside it (see
 * lib/sectionLayout) — ranking columns by popularity next to a page of
 * argument is an editorial position nobody chose.
 */
export default function OpinionFront({ lang, accent, sectionKey, title, tagline, stories }: FrontProps) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const art = sectionArtUrl(sectionKey, accent, 5);

  return (
    <>
      <header className="relative mb-8 overflow-hidden rounded-card px-6 py-6 sm:px-9 sm:py-7" style={{ backgroundColor: accent }}>
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

      {stories.length === 0 && <p className="border-y border-line py-10 text-center text-[15px] text-ink-3">{t.empty}</p>}

      {stories.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
          {stories.map((s) => (
            <OpinionCard
              key={s.id}
              lang={lang}
              href={s.href}
              quote={s.title}
              authorName={s.authorName}
              authorInitial={s.authorInitial}
              authorAvatar={s.authorAvatar}
            />
          ))}
        </div>
      )}
    </>
  );
}
