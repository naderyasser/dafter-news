import Link from "next/link";

import ClockIcon from "@/components/ui/ClockIcon";
import CoverImage from "@/components/ui/CoverImage";
import ListThumb from "@/components/ui/ListThumb";
import SectionHeading from "@/components/site/SectionHeading";
import SectionMore from "@/components/site/SectionMore";
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
 * Image-led section block — the approved «عرب وعالم» treatment: one overlaid
 * lead, then every other story as the same thumbnail row (Side), beside the
 * lead and again under it.
 *
 * The photo runs to the edge of the card with no border or panel, and the
 * country rides *on* the photo as a solid red chip — the client's own
 * reference for this block, flat red regardless of section, same call as
 * HeroCarouselBlock's corner tag. `sectionKey` still recolours the heading
 * rule and headline hover (so «ثقافة وفن» reusing this layout still reads as
 * its own place), just not the chip anymore.
 *
 * The chip stays out of the top-start corner because ArticleCard's «عاجل»/
 * «خاص» badge owns that one; keeping them apart means a breaking world story
 * shows both without them stacking on top of each other.
 *
 * Two placements:
 *
 * - `row` (cards whose headline and time are set INTO the photo) — an
 *   ordinary flex item sharing a row with the timestamp, see MetaRow.
 * - `corner` (the side rail's bare thumbnail, which carries no text) —
 *   absolutely positioned at the bottom-start, where nothing can collide
 *   with it. Truncated rather than let run: at 112px there is no room for
 *   «أمريكا اللاتينية», and `overflow-hidden` on the thumbnail would
 *   otherwise slice it mid-word with nothing to show it had been cut.
 */
function Chip({ label, placement = "row" }: { label?: string; placement?: "row" | "corner" }) {
  if (!label) return null;
  const base =
    "z-10 rounded-badge bg-badge-breaking px-2.5 py-1 text-[11px] font-extrabold text-paper shadow-2 ring-1 ring-inset ring-white/15";
  if (placement === "corner") {
    return <span className={`absolute bottom-2 start-2 max-w-[calc(100%-1rem)] truncate ${base}`}>{label}</span>;
  }
  return <span className={base}>{label}</span>;
}

/**
 * The strip under an overlaid headline: country chip at the inline start,
 * timestamp pushed to the inline end.
 *
 * This is the fix for the reported overlap. The chip was positioned
 * absolutely at the photo's bottom-start corner while the timestamp sat in
 * the overlay's own padding box at that same corner — two elements anchored
 * to one point, so any label with real length («أمريكا اللاتينية») ran
 * straight across the time and made it unreadable. As flex siblings under
 * `justify-between` they cannot overlap at any label length or card width,
 * and `flex-wrap` lets the pair stack rather than collide when a phone-width
 * tile can't seat both on one line.
 *
 * Both halves are optional and the row reads correctly with either missing:
 * with no chip the time falls back to the inline start, exactly where a
 * chipless card has always shown it.
 */
function MetaRow({ chip, time, size = "lead" }: { chip?: string; time?: string; size?: "lead" | "tile" }) {
  if (!chip && !time) return null;
  const isLead = size === "lead";
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 ${isLead ? "mt-2" : "mt-1.5"}`}>
      <Chip label={chip} />
      {time && (
        <span className={`tnum flex items-center gap-1.5 font-semibold text-paper/85 ${isLead ? "text-[13px]" : "text-[12px]"}`}>
          <ClockIcon />
          {time}
        </span>
      )}
    </div>
  );
}

/**
 * The lead — full-bleed photo, headline and time set directly into it over a
 * dark gradient, matching the client's own reference for this block: the
 * photo fills the whole card, and the headline reads in white anchored to
 * the bottom rather than sitting in plain ink underneath it.
 */
function Lead({ card, lang, accent }: { card: WorldCard; lang: Lang; accent: string }) {
  return (
    <Link href={card.href} className="card-link relative block no-underline" style={{ "--card-accent": accent } as React.CSSProperties}>
      <div className="relative overflow-hidden rounded-card">
        <div className="relative aspect-[16/10] max-h-[480px]">
          <CoverImage
            src={card.imageSrc}
            alt={card.title}
            placeholder={DROP[lang]}
            className="absolute inset-0"
            sizes="(min-width: 1024px) 55vw, 100vw"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(10,11,13,.9)] via-[rgba(10,11,13,.2)] to-transparent"
          />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <h3 className={`${lang === "ar" ? "font-display-ar" : "font-display-en"} card-title m-0 line-clamp-3 text-[clamp(1.125rem,0.95rem+0.9vw,1.5rem)] font-extrabold leading-[1.35] text-paper`}>
            {card.title}
          </h3>
          <MetaRow chip={card.label} time={card.time} />
        </div>
      </div>
    </Link>
  );
}

/**
 * The side rail — a small thumbnail beside its own text column, not a full-
 * bleed card. Left as-is: cramming an overlaid headline onto a 112px
 * thumbnail would make it unreadable, and the client's reference only ever
 * shows this treatment on full-width photos.
 */
function Side({ card, lang, accent }: { card: WorldCard; lang: Lang; accent: string }) {
  return (
    <Link href={card.href} className="card-link flex items-center gap-3.5 no-underline" style={{ "--card-accent": accent } as React.CSSProperties}>
      <div className="min-w-0 flex-1">
        {card.kicker && (
          <div className="mb-1 text-[11px] font-bold" style={{ color: accent }}>
            {card.kicker}
          </div>
        )}
        <h3 className={`${lang === "ar" ? "font-display-ar" : "font-display-en"} text-[15px] font-bold leading-[1.5] card-title text-ink`}>{card.title}</h3>
        {card.time && <div className="mt-1.5 text-caption text-ink-3">{card.time}</div>}
      </div>
      {/* The shared square list frame, at the row's inline end like every
          other feed row on the site — this rail used to be the one place
          with a 128px 4:3 photo leading the row. */}
      <ListThumb src={card.imageSrc} alt={card.title} placeholder={DROP[lang]}>
        <Chip label={card.label} placement="corner" />
      </ListThumb>
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
  // The foot of the block — three more stories in the SAME row shape the
  // side rail uses (thumbnail at the inline end, headline, chip on the
  // photo). These were full-bleed overlay tiles like the lead until the
  // client's 2026-09-09 note: one wide dark card under three plain rows
  // read as a different design, not as the same feed continuing. Only the
  // lead keeps the overlay treatment — that one is the client's own
  // reference for this block.
  const foot = rest.slice(3, 6);
  const accent = sectionColor(sectionKey);

  return (
    <section className="section-watermark mx-auto max-w-container px-6 py-8" style={sectionStyle(sectionKey)}>
      <SectionHeading lang={lang} title={title} href={href} sectionKey={sectionKey} />

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

      {foot.length ? (
        <div className="mt-5 grid gap-x-8 border-t border-line pt-1 sm:grid-cols-2 lg:grid-cols-3">
          {foot.map((c, i) => (
            // Hairlines between the rows on a phone, where they stack; on a
            // wider screen the columns separate them and the last row's
            // rule would only underline the block for no reason.
            <div key={c.href + i} className={`py-4 ${i === foot.length - 1 ? "" : "border-b border-line sm:border-b-0"}`}>
              <Side card={c} lang={lang} accent={accent} />
            </div>
          ))}
        </div>
      ) : null}
      <SectionMore lang={lang} href={href} />
    </section>
  );
}
