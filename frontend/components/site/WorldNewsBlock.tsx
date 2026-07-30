import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";
import SectionHeading from "@/components/site/SectionHeading";
import { sectionColor, sectionStyle } from "@/lib/sections";

type Lang = "ar" | "en";

export type WorldCard = {
  href: string;
  title: string;
  /** The chip on the photo — the country when the desk set one, else the
   *  subcategory («سياسة»), else the section name; never blank. */
  label?: string;
  /** Small topic line above a side item's title — set only when the chip is
   *  already spent on the country, so the topic still has somewhere to go. */
  kicker?: string;
  time?: string;
  imageSrc?: string | null;
};

const DROP = { ar: "أفلت صورة الخبر هنا", en: "Drop image here" };
const MORE = { ar: "عرض الكل", en: "See all" };

/**
 * Image-led section block — the approved «عرب وعالم» treatment.
 *
 * The photo runs to the edge of the card with no border or panel, and the
 * category rides *on* the photo as a solid chip. One lead story is given
 * roughly half the block and the rest fill in beside and beneath it, so the
 * section reads as a front page rather than as another even row of tiles.
 *
 * `sectionKey` recolours the whole block — chip, heading rule and headline
 * hover — which is what lets «ثقافة وفن» run the same layout in purple
 * without a second copy of it, per the client's «نفس التصميم لقسم فن ولكن مع
 * تغيير الألوان».
 *
 * The chip sits at the bottom-start corner because ArticleCard's «عاجل»/«خاص»
 * badge owns the top-start one; keeping them apart means a breaking world
 * story shows both without them stacking on top of each other.
 */
function Chip({ label, accent }: { label?: string; accent: string }) {
  if (!label) return null;
  return (
    <span
      className="absolute bottom-0 start-0 z-10 px-2.5 py-1 text-[11px] font-extrabold text-paper"
      style={{ backgroundColor: accent }}
    >
      {label}
    </span>
  );
}

function Lead({ card, lang, accent }: { card: WorldCard; lang: Lang; accent: string }) {
  return (
    <Link href={card.href} className="card-link block no-underline" style={{ "--card-accent": accent } as React.CSSProperties}>
      <div className="relative overflow-hidden rounded-card">
        <div className="relative aspect-[16/10]">
          <CoverImage
            src={card.imageSrc}
            alt={card.title}
            placeholder={DROP[lang]}
            className="absolute inset-0"
            sizes="(min-width: 1024px) 55vw, 100vw"
          />
        </div>
        <Chip label={card.label} accent={accent} />
      </div>
      <h3 className={`${lang === "ar" ? "font-display-ar" : "font-display-en"} card-title mt-3 text-[clamp(1.125rem,0.95rem+0.9vw,1.5rem)] font-extrabold leading-[1.45] text-ink`}>
        {card.title}
      </h3>
      {card.time && <div className="mt-1.5 text-caption text-ink-3">{card.time}</div>}
    </Link>
  );
}

function Side({ card, lang, accent }: { card: WorldCard; lang: Lang; accent: string }) {
  return (
    <Link href={card.href} className="card-link flex gap-3 no-underline" style={{ "--card-accent": accent } as React.CSSProperties}>
      <div className="relative w-[112px] flex-shrink-0 overflow-hidden rounded-card sm:w-[128px]">
        <div className="relative aspect-[4/3]">
          <CoverImage src={card.imageSrc} alt={card.title} placeholder={DROP[lang]} className="absolute inset-0" sizes="128px" />
        </div>
        <Chip label={card.label} accent={accent} />
      </div>
      <div className="min-w-0 flex-1">
        {card.kicker && (
          <div className="mb-1 text-[11px] font-bold" style={{ color: accent }}>
            {card.kicker}
          </div>
        )}
        <h3 className={`${lang === "ar" ? "font-display-ar" : "font-display-en"} text-[15px] font-bold leading-[1.5] card-title text-ink`}>{card.title}</h3>
        {card.time && <div className="mt-1.5 text-caption text-ink-3">{card.time}</div>}
      </div>
    </Link>
  );
}

function Tile({ card, lang, accent }: { card: WorldCard; lang: Lang; accent: string }) {
  return (
    <Link href={card.href} className="card-link block no-underline" style={{ "--card-accent": accent } as React.CSSProperties}>
      <div className="relative overflow-hidden rounded-card">
        <div className="relative aspect-[16/10]">
          <CoverImage
            src={card.imageSrc}
            alt={card.title}
            placeholder={DROP[lang]}
            className="absolute inset-0"
            sizes="(min-width: 768px) 30vw, 100vw"
          />
        </div>
        <Chip label={card.label} accent={accent} />
      </div>
      <h3 className={`${lang === "ar" ? "font-display-ar" : "font-display-en"} mt-2.5 text-h3 font-bold leading-[1.5] card-title text-ink`}>{card.title}</h3>
      {card.time && <div className="mt-1.5 text-caption text-ink-3">{card.time}</div>}
    </Link>
  );
}

export default function WorldNewsBlock({
  lang,
  title,
  href,
  cards,
  sectionKey,
}: {
  lang: Lang;
  title: string;
  href: string;
  cards: WorldCard[];
  /** Recolours chip, rule and hover, and picks the background mark. */
  sectionKey?: string | null;
}) {
  if (!cards.length) return null;

  const [lead, ...rest] = cards;
  const side = rest.slice(0, 3);
  const tiles = rest.slice(3, 6);
  const accent = sectionColor(sectionKey);

  return (
    <section className="section-watermark mx-auto max-w-container px-6 py-8" style={sectionStyle(sectionKey)}>
      <SectionHeading lang={lang} title={title} href={href} moreLabel={MORE[lang]} sectionKey={sectionKey} />

      <div className="flex flex-wrap gap-6">
        <div className="min-w-0 flex-[3_1_420px]">
          <Lead card={lead} lang={lang} accent={accent} />
        </div>
        {side.length ? (
          <div className="flex min-w-0 flex-[2_1_300px] flex-col">
            {side.map((c, i) => (
              // Hairlines between the side stack only — the lead and the tile
              // row are already separated by whitespace.
              <div key={c.href + i} className={i === side.length - 1 ? "" : "mb-4 border-b border-line pb-4"}>
                <Side card={c} lang={lang} accent={accent} />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {tiles.length ? (
        <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5 border-t border-line pt-6">
          {tiles.map((c, i) => (
            <Tile key={c.href + i} card={c} lang={lang} accent={accent} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
