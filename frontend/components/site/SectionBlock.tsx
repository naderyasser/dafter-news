import ArticleCard from "@/components/site/ArticleCard";
import SectionHeading from "@/components/site/SectionHeading";
import SectionMore from "@/components/site/SectionMore";
import SectionMasthead from "@/components/site/SectionMasthead";
import { sectionColor, sectionStyle } from "@/lib/sections";
import type { Badge } from "@/lib/types";

export type SectionBlockCard = {
  href: string;
  title: string;
  section?: string;
  time?: string;
  badge?: Badge;
  imageSrc?: string | null;
  isVideo?: boolean;
  videoDuration?: string;
  comments?: number;
  /** Country label on the photo — set only by «الخليج»/«عرب وعالم» callers. */
  chip?: string;
};

export default function SectionBlock({
  lang,
  title,
  seeAllHref,
  cardVariant = "standard",
  cards,
  initialCount,
  sectionKey,
  coverImage,
  tagline,
}: {
  lang: "ar" | "en";
  title: string;
  seeAllHref: string;
  cardVariant?: "standard" | "compact" | "text" | "hero";
  cards: SectionBlockCard[];
  initialCount?: number;
  /**
   * Drives the heading rule's second tone, the kicker colour on every card in
   * the block, and the subject watermark behind it. Omitted = accent blue and
   * no watermark, which is what an unmapped section should look like.
   */
  sectionKey?: string | null;
  /** A cover photo swaps the plain text heading for the full-bleed masthead. */
  coverImage?: string | null;
  tagline?: string;
}) {
  // Every sibling block on the homepage (HeroSlider, VideoShowcase,
  // SportsBlock, SpecialFilesBlock, WorldNewsBlock) hides itself instead of
  // showing a heading over an empty grid on a quiet day — this is the
  // fallback block for anything the dashboard adds later, so it is the one
  // most likely to actually hit zero, and it was the one block that didn't.
  if (!cards.length) return null;
  // Hard cap, not an expander: the block shows a fixed number of stories and
  // sends a reader who wants more to the desk itself, via the button below.
  const visible = cards.slice(0, initialCount ?? cards.length);
  const accent = sectionColor(sectionKey);

  return (
    <section className="section-watermark mx-auto max-w-container px-6 py-8" style={sectionStyle(sectionKey)}>
      {/* One heading component for every block on the page — this used to be a
          second, hand-rolled copy with its own type size and its own «عرض
          الكل ←» wording, so two blocks in the same column disagreed about
          both. */}
      {coverImage ? (
        <SectionMasthead lang={lang} title={title} tagline={tagline} imageSrc={coverImage} sectionKey={sectionKey} href={seeAllHref} />
      ) : (
        <SectionHeading lang={lang} title={title} href={seeAllHref} sectionKey={sectionKey} />
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
        {visible.map((c, i) => (
          <ArticleCard
            key={c.href + i}
            lang={lang}
            variant={cardVariant}
            href={c.href}
            title={c.title}
            section={c.section}
            time={c.time}
            badge={c.badge ?? "none"}
            imageSrc={c.imageSrc}
            isVideo={c.isVideo}
            videoDuration={c.videoDuration}
            comments={c.comments}
            chip={c.chip}
            accent={accent}
          />
        ))}
      </div>
      <SectionMore lang={lang} href={seeAllHref} />
    </section>
  );
}
