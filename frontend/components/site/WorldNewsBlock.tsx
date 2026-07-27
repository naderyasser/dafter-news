import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";
import SectionHeading from "@/components/site/SectionHeading";

export type WorldCard = {
  href: string;
  title: string;
  /** The red chip — the article's subcategory («سياسة» / «ثقافة وفنون»), with
   *  the section name as a fallback so a card is never left without one. */
  label?: string;
  time?: string;
  imageSrc?: string | null;
};

const DROP = "أفلت صورة الخبر هنا";

/**
 * «عرب وعالم» — image-led, deliberately unlike the «ثقافة وفن» grid above it.
 *
 * The difference is the point: the art block uses the bordered ArticleCard,
 * where the section name is small red *text* under a boxed-in image. Here the
 * photo runs to the edge of the card with no border or panel, and the category
 * rides *on* the photo as a solid red chip. One lead story is given roughly
 * half the block and the rest fill in beside and beneath it, so the section
 * reads as a front page rather than as another even row of tiles.
 *
 * The chip sits at the bottom-start corner because ArticleCard's «عاجل»/«خاص»
 * badge owns the top-start one; keeping them apart means a breaking world
 * story shows both without them stacking on top of each other.
 */
function Chip({ label }: { label?: string }) {
  if (!label) return null;
  return (
    <span className="absolute bottom-0 start-0 z-10 bg-brand px-2.5 py-1 text-[11px] font-extrabold text-paper">
      {label}
    </span>
  );
}

function Lead({ card }: { card: WorldCard }) {
  return (
    <Link href={card.href} className="group block no-underline">
      <div className="relative overflow-hidden rounded-card">
        <div className="relative aspect-[16/10]">
          <CoverImage
            src={card.imageSrc}
            alt={card.title}
            placeholder={DROP}
            className="absolute inset-0"
            sizes="(min-width: 1024px) 55vw, 100vw"
          />
        </div>
        <Chip label={card.label} />
      </div>
      <h3 className="font-display-ar mt-3 text-[clamp(1.125rem,0.95rem+0.9vw,1.5rem)] font-extrabold leading-[1.45] text-ink group-hover:text-brand">
        {card.title}
      </h3>
      {card.time && <div className="mt-1.5 text-caption text-ink-3">{card.time}</div>}
    </Link>
  );
}

function Side({ card }: { card: WorldCard }) {
  return (
    <Link href={card.href} className="group flex gap-3 no-underline">
      <div className="relative w-[112px] flex-shrink-0 overflow-hidden rounded-card sm:w-[128px]">
        <div className="relative aspect-[4/3]">
          <CoverImage src={card.imageSrc} alt={card.title} placeholder={DROP} className="absolute inset-0" sizes="128px" />
        </div>
        <Chip label={card.label} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-display-ar text-[15px] font-bold leading-[1.5] text-ink group-hover:text-brand">{card.title}</h3>
        {card.time && <div className="mt-1.5 text-caption text-ink-3">{card.time}</div>}
      </div>
    </Link>
  );
}

function Tile({ card }: { card: WorldCard }) {
  return (
    <Link href={card.href} className="group block no-underline">
      <div className="relative overflow-hidden rounded-card">
        <div className="relative aspect-[16/10]">
          <CoverImage
            src={card.imageSrc}
            alt={card.title}
            placeholder={DROP}
            className="absolute inset-0"
            sizes="(min-width: 768px) 30vw, 100vw"
          />
        </div>
        <Chip label={card.label} />
      </div>
      <h3 className="font-display-ar mt-2.5 text-h3 font-bold leading-[1.5] text-ink group-hover:text-brand">{card.title}</h3>
      {card.time && <div className="mt-1.5 text-caption text-ink-3">{card.time}</div>}
    </Link>
  );
}

export default function WorldNewsBlock({
  title,
  href,
  cards,
}: {
  title: string;
  href: string;
  cards: WorldCard[];
}) {
  if (!cards.length) return null;

  const [lead, ...rest] = cards;
  const side = rest.slice(0, 3);
  const tiles = rest.slice(3, 6);

  return (
    <section className="mx-auto max-w-container px-6 py-6">
      <SectionHeading lang="ar" title={title} href={href} moreLabel="عرض الكل" />

      <div className="flex flex-wrap gap-6">
        <div className="min-w-0 flex-[3_1_420px]">
          <Lead card={lead} />
        </div>
        {side.length ? (
          <div className="flex min-w-0 flex-[2_1_300px] flex-col">
            {side.map((c, i) => (
              // Hairlines between the side stack only — the lead and the tile
              // row are already separated by whitespace.
              <div key={c.href + i} className={i === side.length - 1 ? "" : "mb-4 border-b border-line pb-4"}>
                <Side card={c} />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {tiles.length ? (
        <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5 border-t border-line pt-6">
          {tiles.map((c, i) => (
            <Tile key={c.href + i} card={c} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
