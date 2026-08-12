import ArticleCard from "@/components/site/ArticleCard";
import type { SectionBlockCard } from "@/components/site/SectionBlock";

/**
 * End-of-article «أخبار ذات صلة» — a compact bordered list (thumbnail beside
 * each headline, stacked one per row) rather than the site's usual card
 * grid, per the client's reference. A grid reads as "more of the section
 * you were just in"; a tight list beside the piece you finished reading
 * reads as "here's where to go next" — the distinction is the whole point
 * of a dedicated component instead of reusing SectionBlock here too.
 */
export default function RelatedArticlesList({
  lang,
  title,
  cards,
}: {
  lang: "ar" | "en";
  title: string;
  cards: SectionBlockCard[];
}) {
  if (cards.length === 0) return null;
  const isAr = lang === "ar";

  return (
    <section className="mx-auto max-w-container px-6 py-8">
      <div
        className={`${isAr ? "font-display-ar" : "font-display-en"} rule-accent mb-3.5 ps-3.5 text-[15px] font-extrabold text-ink`}
      >
        {title}
      </div>
      <div className="max-w-reading divide-y divide-line rounded-card border border-line bg-surface px-4">
        {cards.map((c, i) => (
          <ArticleCard
            key={c.href + i}
            lang={lang}
            variant="compact"
            href={c.href}
            title={c.title}
            time={c.time}
            badge={c.badge}
            imageSrc={c.imageSrc}
          />
        ))}
      </div>
    </section>
  );
}
