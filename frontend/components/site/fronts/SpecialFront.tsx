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
  // Stroked white: a red folder on the red slab would be invisible.
  const artOnDark = sectionArtUrl(sectionKey, "rgba(255,255,255,.95)", 5);

  return (
    <>
      {/* Masthead: a solid slab in the masthead red. This is the one desk that
          speaks in the paper's own voice, so it is the loudest nameplate on
          the site — and the only one that runs straight into the dark stage
          below it, so flag and screen read as a single object. */}
      <header className="relative overflow-hidden rounded-t-card px-5 py-7 sm:px-8" style={{ backgroundColor: accent }}>
        {artOnDark && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-[-20%] end-[-1rem] hidden w-[24%] bg-contain bg-center bg-no-repeat opacity-25 sm:block"
            style={{ backgroundImage: artOnDark }}
          />
        )}
        <h1 className={`${fontDisplay} relative m-0 text-[clamp(1.875rem,1.3rem+2.4vw,3rem)] font-extrabold leading-[1.15] text-paper`}>{title}</h1>
        {tagline && <p className="relative mt-2.5 max-w-[52ch] text-[15px] leading-[1.75] text-paper/85">{tagline}</p>}
      </header>

      {stories.length === 0 ? (
        <p className="rounded-b-card border border-line py-10 text-center text-[15px] text-ink-3">{t.empty}</p>
      ) : (
        <div className="[&>section]:rounded-t-none">
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
        </div>
      )}
    </>
  );
}
