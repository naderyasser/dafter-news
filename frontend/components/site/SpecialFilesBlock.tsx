import Link from "next/link";
import SectionMore from "@/components/site/SectionMore";

import ArrowCarousel from "@/components/site/ArrowCarousel";
import Chevron from "@/components/ui/Chevron";
import CoverImage from "@/components/ui/CoverImage";

type Lang = "ar" | "en";

export type SpecialFileCard = {
  href: string;
  title: string;
  imageSrc?: string | null;
  authorName?: string;
  authorAvatar?: string | null;
  authorInitial?: string;
  time?: string;
};

const T = {
  ar: { kicker: "تحقيقات وتقارير معمّقة", drop: "أفلت صورة الملف هنا" },
  en: { kicker: "Investigations & in-depth reports", drop: "Drop cover here" },
};

/**
 * «ملف خاص» — the magazine treatment, deliberately unlike every news grid.
 *
 * Long-form investigations sit on their own dark band (the client's «خلفية
 * بدرجة لونية مختلفة»), as tall poster cards rather than 16:9 news tiles,
 * with the investigating journalist's face and name ON the card — the
 * reporting is the product here, so the reporter is part of the cover.
 * Gold accents instead of the news red: this shelf is premium, not urgent.
 */
function JournalistChip({ name, avatar, initial }: { name?: string; avatar?: string | null; initial?: string }) {
  if (!name) return null;
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-gold bg-[rgba(6,38,57,.7)]">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-[13px] font-extrabold text-gold">{initial || "؟"}</span>
        )}
      </span>
      <span className="text-[12px] font-bold text-paper/90">{name}</span>
    </span>
  );
}

export default function SpecialFilesBlock({
  lang,
  title,
  href,
  items,
}: {
  lang: Lang;
  title: string;
  href: string;
  items: SpecialFileCard[];
}) {
  if (!items.length) return null;
  const t = T[lang];
  const fontDisplay = lang === "ar" ? "font-display-ar" : "font-display-en";

  return (
    <section className="bg-navy py-8">
      <div className="mx-auto max-w-container px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="border-s-4 border-gold ps-4">
            <h2 className={`${fontDisplay} m-0 text-[clamp(1.25rem,1.05rem+0.9vw,1.625rem)] font-extrabold text-paper`}>{title}</h2>
            <div className="mt-1 text-[13px] text-paper/60">{t.kicker}</div>
          </div>
        </div>

        <ArrowCarousel lang={lang} itemClassName="w-[240px] sm:w-[264px]">
          {items.map((f) => (
            <Link key={f.href} href={f.href} className="group block no-underline">
              <div className="relative overflow-hidden rounded-card ring-1 ring-paper/15 transition-shadow duration-fast group-hover:ring-gold">
                {/* Poster ratio, not the news 16:9 — a file is a cover, not a frame grab. */}
                <div className="relative aspect-[3/4] max-h-[480px]">
                  <CoverImage src={f.imageSrc} alt={f.title} placeholder={t.drop} className="absolute inset-0" sizes="264px" />
                </div>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(6,20,32,.94)] via-[rgba(6,20,32,.35)] to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 p-4">
                  <h3 className={`${fontDisplay} m-0 line-clamp-3 text-[16px] font-extrabold leading-[1.35] text-paper`}>{f.title}</h3>
                  <div className="flex items-center justify-between gap-2">
                    <JournalistChip name={f.authorName} avatar={f.authorAvatar} initial={f.authorInitial} />
                    {f.time && <span className="tnum flex-shrink-0 text-[11px] font-semibold text-paper/70">{f.time}</span>}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </ArrowCarousel>
        <SectionMore lang={lang} href={href} tone="dark" />
      </div>
    </section>
  );
}
