import { toEasternNumerals } from "@/lib/format";
import { sectionArtUrl, sectionColor } from "@/lib/sections";

const T = {
  ar: { one: "خبر واحد", many: (n: string) => `${n} خبر` },
  en: { one: "1 story", many: (n: string) => `${n} stories` },
};

/**
 * The section page's masthead: the section's own colour as a full band, its
 * line-art mark drawn large in white behind the title, and its tagline.
 *
 * This is where «تصميم فريد لكل قسم» becomes visible before a single card
 * loads — a reader landing on «جوّه الجون» sees a green band with a pitch,
 * on «حركة السوق» a gold band with a chart. The identity comes from
 * lib/sections, so a new section gets the plain accent band rather than a
 * broken one, and nobody maintains thirteen headers.
 */
export default function SectionHero({
  lang,
  title,
  tagline,
  sectionKey,
  count,
}: {
  lang: "ar" | "en";
  title: string;
  tagline?: string;
  sectionKey?: string | null;
  count?: number;
}) {
  const isAr = lang === "ar";
  const color = sectionColor(sectionKey);
  // White stroke, so the mark reads as chalk on the coloured band.
  const art = sectionArtUrl(sectionKey, "rgba(255,255,255,.9)", 4);
  const t = T[lang];
  const countLabel = count === undefined ? null : count === 1 ? t.one : t.many(isAr ? toEasternNumerals(count) : String(count));

  return (
    <div className="relative mb-7 overflow-hidden rounded-card" style={{ backgroundColor: color }}>
      {/* A quiet darkening keeps white copy readable on the lighter section
          colours (amber, gold) without dimming the dark ones noticeably. */}
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(0,0,0,.22),rgba(0,0,0,0)_60%)]" aria-hidden />
      {art && (
        <div
          aria-hidden
          className="absolute inset-y-0 end-0 w-[46%] bg-contain bg-center bg-no-repeat opacity-[.16]"
          style={{ backgroundImage: art }}
        />
      )}
      <div className="relative px-6 py-7 sm:px-8">
        <h1 className={`${isAr ? "font-display-ar" : "font-display-en"} m-0 text-[clamp(1.625rem,1.3rem+1.4vw,2.25rem)] font-extrabold text-paper`}>
          {title}
        </h1>
        {tagline && <p className="mt-1.5 max-w-[52ch] text-[14px] leading-[1.7] text-paper/85">{tagline}</p>}
        {countLabel && (
          <span className="tnum mt-3 inline-block rounded-pill bg-[rgba(255,255,255,.16)] px-3 py-1 text-[12px] font-bold text-paper">
            {countLabel}
          </span>
        )}
      </div>
    </div>
  );
}
