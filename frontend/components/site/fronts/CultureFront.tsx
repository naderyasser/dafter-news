import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";
import { formatDate } from "@/lib/format";
import { sectionArtUrl } from "@/lib/sections";
import type { FrontProps, FrontStory } from "./types";

const T = {
  ar: { drop: "أفلت صورة العمل هنا", empty: "لا موضوعات على هذا المكتب بعد." },
  en: { drop: "Drop image here", empty: "Nothing on this desk yet." },
};

/**
 * The salon hang: five slots that repeat, so a wall of any length keeps its
 * rhythm without anything being placed at random.
 *
 * Two wide works to a row, then three narrow ones — the alternation a curator
 * uses to stop a hang reading as a spreadsheet. The aspect ratios differ per
 * slot for the same reason: identical crops are what make a culture page look
 * like a stock grid no matter how good the photography is.
 */
const HANG = [
  { span: "sm:col-span-3", ratio: "aspect-[4/5]" },
  { span: "sm:col-span-3", ratio: "aspect-[4/3]" },
  { span: "sm:col-span-2", ratio: "aspect-[1/1]" },
  { span: "sm:col-span-2", ratio: "aspect-[3/4]" },
  { span: "sm:col-span-2", ratio: "aspect-[1/1]" },
];

/**
 * «ثقافة وفن» — the gallery wall.
 *
 * The old culture page was two columns of equal photo cards, each printing its
 * headline and then the same sentence again as a standfirst. It was the single
 * most templated page on the site, on the one desk whose whole subject is how
 * things look.
 *
 * So every piece is hung as a work: a white mat, a hairline frame, and a
 * museum label centred underneath carrying the title, the writer and the date.
 * The frames are deliberately different sizes and crops — a wall, not a grid.
 * The label is the signature, and everything else on the page stays quiet
 * enough to let the pictures do the work.
 */
export default function CultureFront({ lang, accent, sectionKey, title, tagline, stories }: FrontProps) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const art = sectionArtUrl(sectionKey, accent, 5);
  const accentVar = { "--card-accent": accent } as React.CSSProperties;
  const [feature, ...wall] = stories;

  const Label = ({ s, large = false }: { s: FrontStory; large?: boolean }) => (
    <figcaption className="mt-3 text-center">
      <h3 className={`${fontDisplay} card-title m-0 font-extrabold leading-[1.5] text-ink ${large ? "text-[clamp(1.125rem,.95rem+1vw,1.5rem)]" : "text-[15px]"}`}>
        {s.title}
      </h3>
      <p className="mt-1.5 text-[12px] leading-[1.6] text-ink-3">
        {s.authorName && (
          <span className="font-bold" style={{ color: accent }}>
            {s.authorName}
          </span>
        )}
        {s.authorName && (s.iso || s.time) && <span aria-hidden> · </span>}
        {formatDate(s.iso, lang) || s.time}
      </p>
    </figcaption>
  );

  return (
    <>
      {/* Masthead: the introduction panel at a gallery entrance — centred
          inside a hairline frame, with the palette mark set small above the
          name rather than ghosted behind it. The only symmetrical masthead on
          the site, because everything below it is hung symmetrically too. */}
      <header className="relative mx-auto mb-10 max-w-[620px] border px-6 py-7 text-center" style={{ borderColor: accent }}>
        {art && (
          <span
            aria-hidden
            className="mx-auto mb-3 block h-[42px] w-[70px] bg-contain bg-center bg-no-repeat opacity-75"
            style={{ backgroundImage: art }}
          />
        )}
        <h1 className={`${fontDisplay} m-0 text-[clamp(1.625rem,1.2rem+1.8vw,2.5rem)] font-extrabold leading-[1.25]`} style={{ color: accent }}>
          {title}
        </h1>
        {tagline && <p className="mx-auto mt-2.5 max-w-[46ch] text-[14.5px] leading-[1.8] text-ink-2">{tagline}</p>}
      </header>

      {!feature && <p className="border-y border-line py-10 text-center text-[15px] text-ink-3">{t.empty}</p>}

      {/* The featured work, hung on its own and centred. */}
      {feature && (
        <Link href={feature.href} className="card-link mx-auto mb-11 block max-w-[560px] no-underline" style={accentVar}>
          <figure className="m-0">
            <span className="block bg-paper p-3 shadow-2 ring-1 ring-line">
              <span className="relative block aspect-[5/4] overflow-hidden ring-1 ring-ink/10">
                <CoverImage src={feature.imageSrc} alt={feature.title} placeholder={t.drop} className="absolute inset-0" sizes="(min-width: 640px) 560px, 100vw" />
              </span>
            </span>
            <Label s={feature} large />
            {feature.standfirst && (
              <p className="mx-auto mt-2 max-w-[46ch] text-center text-[14px] leading-[1.75] text-ink-2">{feature.standfirst}</p>
            )}
          </figure>
        </Link>
      )}

      {wall.length > 0 && (
        <div className="grid gap-x-6 gap-y-9 sm:grid-cols-6">
          {wall.map((s, i) => {
            const slot = HANG[i % HANG.length];
            return (
              <Link key={s.id} href={s.href} className={`card-link block no-underline ${slot.span}`} style={accentVar}>
                <figure className="m-0">
                  <span className="block bg-paper p-2.5 shadow-1 ring-1 ring-line">
                    <span className={`relative block overflow-hidden ring-1 ring-ink/10 ${slot.ratio}`}>
                      <CoverImage src={s.imageSrc} alt={s.title} placeholder={t.drop} className="absolute inset-0" sizes="(min-width: 640px) 33vw, 100vw" />
                    </span>
                  </span>
                  <Label s={s} />
                </figure>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
