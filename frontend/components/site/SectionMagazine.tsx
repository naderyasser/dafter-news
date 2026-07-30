"use client";

import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";

type Lang = "ar" | "en";

export type MagazineCard = {
  id: number;
  href: string;
  title: string;
  standfirst?: string;
  imageSrc?: string;
  time: string;
  authorName?: string;
  authorAvatar?: string;
  authorInitial?: string;
};

const T = {
  ar: { drop: "أفلت صورة الموضوع هنا", read: "اقرأ الملف" },
  en: { drop: "Drop cover here", read: "Read the file" },
};

function Byline({ name, avatar, initial, accent }: { name?: string; avatar?: string; initial?: string; accent?: string }) {
  if (!name) return null;
  return (
    <span className="mt-3 flex items-center gap-2">
      <span
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border bg-surface-2 text-[11px] font-extrabold"
        style={accent ? { borderColor: accent, color: accent } : undefined}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={name} className="h-full w-full object-cover" />
        ) : (
          initial || "؟"
        )}
      </span>
      <span className="text-[12px] font-bold text-ink-2">{name}</span>
    </span>
  );
}

/**
 * The long-form archetype: «ملف خاص», «ثقافة وفن», «دليلك الأول».
 *
 * These sections are read by browsing, not scanning, so the page is built
 * for dwell rather than for speed — a full-bleed opener, then wide cards
 * carrying a standfirst and the writer's byline. The reporting is the
 * product on these desks, so the reporter is on the card.
 */
export default function SectionMagazine({
  lang,
  cards,
  accent,
}: {
  lang: Lang;
  cards: MagazineCard[];
  accent?: string;
}) {
  const t = T[lang];
  const fontDisplay = lang === "ar" ? "font-display-ar" : "font-display-en";
  if (!cards.length) return null;

  const [lead, ...rest] = cards;
  const accentVar = accent ? ({ "--card-accent": accent } as React.CSSProperties) : undefined;

  return (
    <>
      {/* The opener runs the full column, standfirst and all. */}
      <Link href={lead.href} className="card-link mb-8 block no-underline" style={accentVar}>
        <div className="relative overflow-hidden rounded-card">
          <div className="relative aspect-[21/9]">
            <CoverImage src={lead.imageSrc} alt={lead.title} placeholder={t.drop} className="absolute inset-0" sizes="(min-width: 1024px) 60vw, 100vw" />
          </div>
        </div>
        <h2 className={`${fontDisplay} card-title mt-4 text-[clamp(1.375rem,1.1rem+1.4vw,2rem)] font-extrabold leading-[1.4] text-ink`}>
          {lead.title}
        </h2>
        {lead.standfirst && <p className="mt-2 text-[16px] leading-[1.7] text-ink-2">{lead.standfirst}</p>}
        <Byline name={lead.authorName} avatar={lead.authorAvatar} initial={lead.authorInitial} accent={accent} />
      </Link>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-x-6 gap-y-8 border-t border-line pt-8">
        {rest.map((c) => (
          <Link key={c.id} href={c.href} className="card-link block no-underline" style={accentVar}>
            <div className="relative overflow-hidden rounded-card">
              <div className="relative aspect-[3/2]">
                <CoverImage src={c.imageSrc} alt={c.title} placeholder={t.drop} className="absolute inset-0" sizes="(min-width: 768px) 340px, 100vw" />
              </div>
            </div>
            <h3 className={`${fontDisplay} card-title mt-3 text-[17px] font-extrabold leading-[1.5] text-ink`}>{c.title}</h3>
            {c.standfirst && <p className="mt-1.5 line-clamp-2 text-[14px] leading-[1.6] text-ink-2">{c.standfirst}</p>}
            <Byline name={c.authorName} avatar={c.authorAvatar} initial={c.authorInitial} accent={accent} />
          </Link>
        ))}
      </div>
    </>
  );
}
