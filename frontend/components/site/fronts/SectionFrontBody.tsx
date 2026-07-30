import SectionHero from "@/components/site/SectionHero";
import SectionNewswire from "@/components/site/SectionNewswire";
import CultureFront from "@/components/site/fronts/CultureFront";
import EgyptFront from "@/components/site/fronts/EgyptFront";
import GuideFront from "@/components/site/fronts/GuideFront";
import GulfFront from "@/components/site/fronts/GulfFront";
import MarketsFront from "@/components/site/fronts/MarketsFront";
import OpinionFront from "@/components/site/fronts/OpinionFront";
import PoliticsFront from "@/components/site/fronts/PoliticsFront";
import SecurityFront from "@/components/site/fronts/SecurityFront";
import SpecialFront from "@/components/site/fronts/SpecialFront";
import SportsFront from "@/components/site/fronts/SportsFront";
import TechFront from "@/components/site/fronts/TechFront";
import WatchFront from "@/components/site/fronts/WatchFront";
import WorldFront from "@/components/site/fronts/WorldFront";
import type { FrontKey } from "@/lib/sectionLayout";
import type { Match, Paginated, TickerPayload, Video } from "@/lib/types";
import type { FrontProps } from "./types";

export type FrontFeeds = {
  matches?: Paginated<Match> | null;
  ticker?: TickerPayload | null;
  videos?: Paginated<Video> | null;
};

/**
 * Picks the desk's front. The only place that knows which component a
 * FrontKey means.
 *
 * Both /section/[key] and /en/section/[key] render through here, so a desk
 * cannot end up with one design in Arabic and another in English — which is
 * exactly what happened while the two pages each carried their own copy of
 * the archetype switch.
 *
 * `newswire` is the fallback, not a design: a section somebody adds in the
 * dashboard tomorrow gets a working page with a masthead and a story list
 * rather than a blank one, until a front is written for it.
 */
export default function SectionFrontBody({
  front,
  feeds,
  count,
  ...props
}: FrontProps & { front: FrontKey; feeds: FrontFeeds; count: number }) {
  switch (front) {
    case "politics":
      return <PoliticsFront {...props} />;
    case "egypt":
      return <EgyptFront {...props} />;
    case "gulf":
      return <GulfFront {...props} />;
    case "world":
      return <WorldFront {...props} />;
    case "security":
      return <SecurityFront {...props} />;
    case "markets":
      return <MarketsFront {...props} ticker={feeds.ticker} />;
    case "sports":
      return <SportsFront {...props} matches={feeds.matches} />;
    case "tech":
      return <TechFront {...props} />;
    case "culture":
      return <CultureFront {...props} />;
    case "guide":
      return <GuideFront {...props} />;
    case "opinion":
      return <OpinionFront {...props} />;
    case "special":
      return <SpecialFront {...props} />;
    case "watch":
      return <WatchFront {...props} videos={feeds.videos} />;

    default:
      return (
        <>
          <SectionHero
            lang={props.lang}
            title={props.title}
            tagline={props.tagline}
            sectionKey={props.sectionKey}
            count={count}
          />
          <SectionNewswire
            lang={props.lang}
            accent={props.accent}
            cards={props.stories.map((s) => ({
              id: s.id,
              href: s.href,
              title: s.title,
              time: s.time,
              badge: s.badge,
              imageSrc: s.imageSrc,
              views: s.views,
              chip: s.country,
            }))}
          />
        </>
      );
  }
}
