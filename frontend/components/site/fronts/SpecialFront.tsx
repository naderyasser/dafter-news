import SpecialShowcase from "@/components/site/SpecialShowcase";
import { sectionArtUrl } from "@/lib/sections";
import type { FrontProps } from "./types";

const T = {
  ar: { empty: "لا ملفات منشورة بعد." },
  en: { empty: "No files published yet." },
};

/**
 * «ملف خاص» — now showing.
 *
 * The stage itself is SpecialShowcase and is left exactly as the client signed
 * it off: one file posted centre, its neighbours dimmed in the wings, a dot
 * strip counting the shelf. What this adds is the desk's own flag above it, so
 * «ملف خاص» arrives at a section masthead like every other desk instead of
 * dropping the reader straight onto a carousel with no page title.
 *
 * This is the one desk that wears the masthead red rather than a colour of its
 * own: a special file is the paper speaking in its own voice.
 */
export default function SpecialFront({ lang, accent, sectionKey, title, tagline, stories }: FrontProps) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const art = sectionArtUrl(sectionKey, accent, 5);

  return (
    <>
      <header className="relative mb-7 border-t-[5px] pt-5" style={{ borderColor: accent }}>
        {art && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-[-30%] end-0 hidden w-[20%] bg-contain bg-center bg-no-repeat opacity-[.1] sm:block"
            style={{ backgroundImage: art }}
          />
        )}
        <h1 className={`${fontDisplay} relative m-0 text-[clamp(1.75rem,1.2rem+2.2vw,2.75rem)] font-extrabold leading-[1.2]`} style={{ color: accent }}>
          {title}
        </h1>
        {tagline && <p className="relative mt-2 max-w-[54ch] text-[15px] leading-[1.75] text-ink-2">{tagline}</p>}
      </header>

      {stories.length === 0 ? (
        <p className="border-y border-line py-10 text-center text-[15px] text-ink-3">{t.empty}</p>
      ) : (
        <SpecialShowcase
          lang={lang}
          items={stories.map((s) => ({
            href: s.href,
            title: s.title,
            imageSrc: s.imageSrc,
            authorName: s.authorName,
            authorAvatar: s.authorAvatar,
            authorInitial: s.authorInitial,
          }))}
        />
      )}
    </>
  );
}
