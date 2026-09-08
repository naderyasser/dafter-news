import Link from "next/link";

import SectionHeading from "@/components/site/SectionHeading";
import SnapSlider from "@/components/site/SnapSlider";
import CoverImage from "@/components/ui/CoverImage";
import { articleCoverFallback } from "@/lib/coverFallback";
import { sectionColor, sectionStyle } from "@/lib/sections";

export type OpinionSlide = {
  name: string;
  quote: string;
  href: string;
  initial: string;
  avatar?: string;
  /** The column's own cover photo, when it has one; the portrait otherwise. */
  imageSrc?: string;
};

const T = {
  ar: { title: "بالعقل والمنطق", label: "مقالات الرأي", writes: "يكتب" },
  en: { title: "By Reason & Logic", label: "Opinion columns", writes: "writes" },
};

const AUTOPLAY_MS = 6000;

/**
 * «بالعقل والمنطق» on the home page — the client's «مقالات» slider.
 *
 * What the reference shows, and what this is: a nameplate row with the
 * paging arrows in its far corner; one prominent rounded (2xl) portrait card
 * per slot, the writer's photograph under a navy gradient, the column's
 * headline and the byline set into it in white; flat dashes under the rail
 * marking the page; swipe on a phone, three abreast on a desktop.
 *
 * On paper, not the navy band it replaced. That band sat directly under
 * «ملف خاص»'s own dark shelf and the two read as one long dark stretch; on
 * white, the desk's navy lives inside the cards instead, which is where the
 * portraits need it for the type to hold.
 *
 * The typography is the editorial half of the ask: the quote glyph in the
 * masthead red, the headline in the naskh body face (Plex Arabic) at a
 * heavier weight rather than the Kufi display face the news cards use — a
 * column is a voice, and it should not be set like a wire headline.
 *
 * Image: the column's cover when it has one, else the writer's portrait
 * (production portraits are 1500px+, so a 380px card stays sharp), else the
 * site's mark — the same ladder every card on the site climbs.
 */
export default function OpinionSlider({
  lang,
  items,
  seeAllHref,
}: {
  lang: "ar" | "en";
  items: OpinionSlide[];
  seeAllHref: string;
}) {
  if (!items.length) return null;
  const isAr = lang === "ar";
  const t = T[lang];
  const accent = sectionColor("opinion");

  return (
    <section className="section-watermark mx-auto max-w-container px-6 py-8" style={sectionStyle("opinion")}>
      <SnapSlider
        lang={lang}
        ariaLabel={t.label}
        indicator="dashes"
        autoplayMs={AUTOPLAY_MS}
        itemClassName="w-[82%] sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]"
        heading={<SectionHeading lang={lang} title={t.title} href={seeAllHref} sectionKey="opinion" moreHref={seeAllHref} className="" />}
      >
        {items.map((op) => {
          const fallback = articleCoverFallback("opinion", op.avatar || null);
          const src = op.imageSrc || fallback.src;
          const fit = op.imageSrc ? "cover" : fallback.fit;
          return (
            <Link
              key={op.href}
              href={op.href}
              className="card-link group relative block overflow-hidden rounded-2xl bg-navy shadow-1 transition-shadow duration-med hover:shadow-2"
              style={{ "--card-accent": accent } as React.CSSProperties}
            >
              <div className="relative aspect-[4/5]">
                <CoverImage
                  src={src}
                  alt={op.name}
                  placeholder={op.initial}
                  placeholderClassName="bg-navy-2 text-paper text-[64px]"
                  className="absolute inset-0"
                  sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 82vw"
                  fit={fit}
                  position="top"
                />
                {/* Navy, not black: the desk's colour is what turns a
                    portrait into an opinion card rather than a news photo. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(7,50,82,.96)] via-[rgba(7,50,82,.5)] via-40% to-[rgba(7,50,82,.08)]"
                />
              </div>

              <span aria-hidden className="absolute start-4 top-2 z-10 font-serif text-[56px] font-extrabold leading-none text-brand drop-shadow">
                &ldquo;
              </span>

              <div className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-5">
                <p className={`${isAr ? "font-body-ar" : "font-body-en"} m-0 line-clamp-4 text-[clamp(1rem,0.92rem+0.5vw,1.1875rem)] font-bold leading-[1.6] text-paper`}>
                  {op.quote}
                </p>
                <div className="mt-3.5 flex items-center gap-2.5 border-t border-white/15 pt-3">
                  <span className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper text-[14px] font-extrabold text-navy ring-2 ring-brand">
                    {op.avatar ? (
                      <CoverImage src={op.avatar} alt="" placeholder="" className="absolute inset-0" sizes="36px" position="top" />
                    ) : (
                      op.initial
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-bold text-paper">{op.name}</span>
                    <span className="block text-[11.5px] text-paper/70">{t.label}</span>
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </SnapSlider>
    </section>
  );
}
