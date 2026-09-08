import Link from "next/link";

import ArticleCard from "@/components/site/ArticleCard";
import CoverImage from "@/components/ui/CoverImage";
import { articleCoverFallback } from "@/lib/coverFallback";
import type { FrontProps, FrontStory } from "./types";

const T = {
  ar: { drop: "أفلت صورة الخبر هنا", more: "المزيد من الأخبار", empty: "لا أخبار على هذا المكتب بعد." },
  en: { drop: "Drop image here", more: "More stories", empty: "Nothing on this desk yet." },
};

/** How many stories after the lead get a photo card before the run of rows. */
export const GRID_COUNT = 6;

/** The section flag: a heavy rule over a hairline, the printed-paper device. */
function Flag({ accent }: { accent: string }) {
  return (
    <span aria-hidden className="block">
      <span className="block h-[3px]" style={{ backgroundColor: accent }} />
      <span className="mt-[3px] block h-px" style={{ backgroundColor: accent, opacity: 0.45 }} />
    </span>
  );
}

/** The kicker over a card: the story's subject, else its country, else nothing. */
const kickerOf = (s: FrontStory) => s.subject || s.country || undefined;

/**
 * The one section front, since 2026-09-09.
 *
 * Thirteen desks used to wear thirteen fronts — a dated chronicle for
 * politics, a docket for the courts, a drafting board for tech — each with
 * its own masthead and its own device, and most of them setting the lead
 * headline in white over a darkened photograph. The client's note on the
 * result: «تنسيق عشوائي وتداخل في العناصر، مع وجود تظليل/صور داكنة غير مريحة
 * للعين». Read back, they were right: a reader clicking «عرض المزيد» on one
 * desk after another met a different page every time, and none of them
 * looked like the feed they had just left.
 *
 * So every article desk now renders THIS, and it is built from the site's
 * own two card shapes and nothing else: the lead as a photo beside its
 * headline (never under it — no scrim, no gradient, no white-on-photo
 * text), then a responsive grid of the standard photo card, then the rest
 * of the desk as the same thumbnail row every list on the site uses. One
 * component, so a card on «سياسة» is the card on «شؤون مصر» is the card on
 * the home page.
 *
 * What still tells the desks apart is the accent (the flag, the kickers,
 * the headline hover) and the tagline under the title — identity, not
 * structure. The two desks whose masthead IS data («حركة السوق»'s board,
 * «جوّه الجون»'s fixtures) keep that masthead and share this body; see
 * MarketsFront and SportsFront.
 *
 * Order is the API's own — strictly newest first (getSectionFeed). Nothing
 * here re-sorts, and no card carries a timestamp: the earlier CTR ask, that
 * a browsing card not advertise how old a story is, still stands.
 *
 * `between` is a slot rendered between the grid and the rows and hidden
 * from `lg` up — the section page puts its «الأكثر قراءة» rail there on a
 * phone, where the sidebar would otherwise land under two dozen stories.
 */
export function NewsGridBody({
  lang,
  accent,
  stories,
  between,
}: Pick<FrontProps, "lang" | "accent" | "stories"> & { between?: React.ReactNode }) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const accentVar = { "--card-accent": accent } as React.CSSProperties;
  const [lead, ...others] = stories;
  const grid = others.slice(0, GRID_COUNT);
  const rows = others.slice(GRID_COUNT);

  if (!lead) return <p className="border-y border-line py-10 text-center text-[15px] text-ink-3">{t.empty}</p>;

  const leadFallback = lead.imageSrc ? null : articleCoverFallback("news", null);
  const leadKicker = kickerOf(lead);

  return (
    <>
      {/* The lead: the photograph and the headline side by side from `md`,
          stacked on a phone. The headline is the largest on the page and
          sits in plain ink on paper — this is the one thing every replaced
          front got wrong, and the one thing the client named. */}
      <Link href={lead.href} className="card-link mb-8 block no-underline" style={accentVar} data-front-lead>
        <article className="grid gap-5 md:grid-cols-[1.5fr_1fr] md:items-center">
          <div className="relative aspect-[16/9] overflow-hidden rounded-card bg-surface-2">
            <CoverImage
              src={lead.imageSrc || leadFallback?.src}
              alt={lead.title}
              placeholder={t.drop}
              className="absolute inset-0"
              sizes="(min-width: 1024px) 640px, 100vw"
              fit={leadFallback?.fit}
              position={leadFallback?.position}
            />
          </div>
          <div>
            {leadKicker && (
              <span className="text-[12px] font-bold" style={{ color: accent }}>
                {leadKicker}
              </span>
            )}
            <h2 className={`${fontDisplay} card-title m-0 mt-1.5 text-[clamp(1.25rem,1rem+1.4vw,1.75rem)] font-extrabold leading-[1.45] text-ink`}>
              {lead.title}
            </h2>
            {lead.standfirst && <p className="mt-2 line-clamp-3 text-[15px] leading-[1.75] text-ink-2">{lead.standfirst}</p>}
          </div>
        </article>
      </Link>

      {grid.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-front-grid>
          {grid.map((s) => (
            <ArticleCard
              key={s.id}
              lang={lang}
              variant="standard"
              href={s.href}
              title={s.title}
              section={kickerOf(s)}
              badge={s.badge}
              imageSrc={s.imageSrc}
              kind="news"
              accent={accent}
            />
          ))}
        </div>
      )}

      {between && <div className="mt-8 lg:hidden">{between}</div>}

      {rows.length > 0 && (
        <section className="mt-8" data-front-rows>
          <h2 className={`${fontDisplay} rule-accent m-0 ps-3.5 text-[17px] font-extrabold text-ink`}>{t.more}</h2>
          <div className="mt-2 grid gap-x-8 md:grid-cols-2">
            {rows.map((s) => (
              <div key={s.id} className="border-b border-line">
                <ArticleCard
                  lang={lang}
                  variant="compact"
                  href={s.href}
                  title={s.title}
                  badge={s.badge}
                  imageSrc={s.imageSrc}
                  kind="news"
                  accent={accent}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/**
 * Masthead + body. A light masthead — the desk's flag, its title in ink, its
 * tagline — on the page's own paper; no coloured band, no watermark art, no
 * darkening gradient. The desk's colour is in the flag and the kickers.
 */
export default function NewsGridFront({ lang, accent, title, tagline, stories, between }: FrontProps & { between?: React.ReactNode }) {
  const isAr = lang === "ar";
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";

  return (
    <>
      <header className="mb-7">
        <Flag accent={accent} />
        <div className="px-1 pb-3 pt-4">
          <h1 className={`${fontDisplay} m-0 text-[clamp(1.75rem,1.2rem+2.2vw,2.5rem)] font-extrabold leading-[1.2] text-ink`}>{title}</h1>
          {tagline && <p className="m-0 mt-1.5 max-w-[54ch] text-[15px] leading-[1.75] text-ink-2">{tagline}</p>}
        </div>
        <Flag accent={accent} />
      </header>
      <NewsGridBody lang={lang} accent={accent} stories={stories} between={between} />
    </>
  );
}
