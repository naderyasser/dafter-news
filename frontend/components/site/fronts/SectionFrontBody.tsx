import MarketsFront from "@/components/site/fronts/MarketsFront";
import MoreFromPaper from "@/components/site/fronts/MoreFromPaper";
import NewsGridFront from "@/components/site/fronts/NewsGridFront";
import OpinionFront from "@/components/site/fronts/OpinionFront";
import SportsFront from "@/components/site/fronts/SportsFront";
import WatchFront from "@/components/site/fronts/WatchFront";
import type { FrontKey } from "@/lib/sectionLayout";
import type { Match, Paginated, TickerPayload, Video } from "@/lib/types";
import type { FrontProps, FrontStory } from "./types";

export type FrontFeeds = {
  matches?: Paginated<Match> | null;
  ticker?: TickerPayload | null;
  videos?: Paginated<Video> | null;
};

/**
 * Below this, a desk is having a quiet week and the cross-paper rail is worth
 * more to a reader than the white space under a two-item column. Five is where
 * the shortest body that still fills its column stops ending above the
 * «الأكثر قراءة» rail beside it.
 */
const THIN_DESK = 5;

/**
 * Picks the desk's front. The only place that knows which component a
 * FrontKey means.
 *
 * Both /section/[key] and /en/section/[key] render through here, so a desk
 * cannot end up with one design in Arabic and another in English — which is
 * exactly what happened while the two pages each carried their own copy of
 * the archetype switch.
 *
 * Since 2026-09-09 there are four fronts, not fourteen: every article desk
 * is `news` (NewsGridFront — see its own docstring for the client note that
 * collapsed the thirteen bespoke ones), the two data desks keep their
 * masthead over the same body, and the video and opinion desks keep their
 * own pages because their content is a different thing (a video table, a
 * run of columnists), not because they wanted a different card.
 *
 * `between` is passed through to the news body — the page's «الأكثر قراءة»
 * for the phone, rendered between the grid and the rows.
 */
export default function SectionFrontBody({
  front,
  feeds,
  more,
  between,
  ...props
}: FrontProps & { front: FrontKey; feeds: FrontFeeds; more?: FrontStory[]; between?: React.ReactNode }) {
  // What this desk is actually about to render. «لقطة وتعليق» keeps its
  // stories in the video table, so counting the article list would call a busy
  // desk empty and hang a "rest of the paper" rail under a full page.
  const shown = front === "watch" ? feeds.videos?.results.length ?? 0 : props.stories.length;

  const body = (() => {
    switch (front) {
      case "markets":
        return <MarketsFront {...props} ticker={feeds.ticker} between={between} />;
      case "sports":
        return <SportsFront {...props} matches={feeds.matches} between={between} />;
      case "opinion":
        return <OpinionFront {...props} />;
      case "watch":
        return <WatchFront {...props} videos={feeds.videos} />;
      default:
        return <NewsGridFront {...props} between={between} />;
    }
  })();

  return (
    <>
      {body}
      {shown < THIN_DESK && more && more.length > 0 && <MoreFromPaper lang={props.lang} items={more} />}
    </>
  );
}
