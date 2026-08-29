import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SectionFrontBody from "./SectionFrontBody";
import type { FrontStory } from "./types";

/**
 * The dispatcher only — every front is stubbed with its own marker.
 *
 * This is the one place that knows which component a FrontKey means, and
 * both /section/[key] and /en/section/[key] render through it, so a wrong
 * mapping here gives a desk one design in Arabic and another in English.
 * Rendering the real fronts would test their internals instead of the
 * routing, and would break this file every time one of them is restyled.
 *
 * The factories are written out rather than built by a helper: vi.mock is
 * hoisted above every declaration in the file, so a shared `stub()` is not
 * yet initialised when the factory runs.
 */
vi.mock("@/components/site/fronts/PoliticsFront", () => ({ default: () => <div data-front="politics" /> }));
vi.mock("@/components/site/fronts/EgyptFront", () => ({ default: () => <div data-front="egypt" /> }));
vi.mock("@/components/site/fronts/GulfFront", () => ({ default: () => <div data-front="gulf" /> }));
vi.mock("@/components/site/fronts/WorldFront", () => ({ default: () => <div data-front="world" /> }));
vi.mock("@/components/site/fronts/SecurityFront", () => ({ default: () => <div data-front="security" /> }));
vi.mock("@/components/site/fronts/MarketsFront", () => ({ default: () => <div data-front="markets" /> }));
vi.mock("@/components/site/fronts/SportsFront", () => ({ default: () => <div data-front="sports" /> }));
vi.mock("@/components/site/fronts/TechFront", () => ({ default: () => <div data-front="tech" /> }));
vi.mock("@/components/site/fronts/CultureFront", () => ({ default: () => <div data-front="culture" /> }));
vi.mock("@/components/site/fronts/GuideFront", () => ({ default: () => <div data-front="guide" /> }));
vi.mock("@/components/site/fronts/OpinionFront", () => ({ default: () => <div data-front="opinion" /> }));
vi.mock("@/components/site/fronts/SpecialFront", () => ({ default: () => <div data-front="special" /> }));
vi.mock("@/components/site/fronts/WatchFront", () => ({ default: () => <div data-front="watch" /> }));
vi.mock("@/components/site/fronts/MoreFromPaper", () => ({ default: () => <div data-more-from-paper /> }));
vi.mock("@/components/site/SectionHero", () => ({ default: () => <div data-hero /> }));
vi.mock("@/components/site/SectionNewswire", () => ({ default: () => <div data-newswire /> }));

const story = (id: number): FrontStory =>
  ({
    id,
    href: `/article/a${id}`,
    title: `خبر ${id}`,
    time: "منذ ساعة",
    badge: "none",
    imageSrc: null,
    views: 0,
  }) as FrontStory;

const props = (over: Record<string, unknown> = {}) =>
  ({
    lang: "ar" as const,
    title: "قسم",
    tagline: "",
    accent: "#12793F",
    sectionKey: "sports",
    stories: [story(1), story(2), story(3), story(4), story(5), story(6)],
    feeds: {},
    count: 6,
    // The rail needs somewhere to send the reader as well as a thin desk;
    // without `more` it stays away however empty the section is.
    more: [story(90), story(91)],
    ...over,
  }) as any;

const FRONTS = [
  "politics", "egypt", "gulf", "world", "security", "markets",
  "sports", "tech", "culture", "guide", "opinion", "special", "watch",
] as const;

describe("SectionFrontBody", () => {
  it("renders the right front for every key it knows", () => {
    for (const front of FRONTS) {
      const { container, unmount } = render(<SectionFrontBody {...props({ front })} />);

      expect(container.querySelector(`[data-front="${front}"]`), front).not.toBeNull();
      unmount();
    }
  });

  it("falls back to a masthead and a story list for a key it has never seen", () => {
    // A section added in the dashboard tomorrow gets a working page rather
    // than a blank one, until a front is written for it.
    const { container } = render(<SectionFrontBody {...props({ front: "something-new" })} />);

    expect(container.querySelector("[data-hero]")).not.toBeNull();
    expect(container.querySelector("[data-newswire]")).not.toBeNull();
  });

  it("hangs the cross-paper rail under a desk that is having a quiet week", () => {
    const { container } = render(<SectionFrontBody {...props({ front: "tech", stories: [story(1), story(2)] })} />);

    expect(container.querySelector("[data-more-from-paper]")).not.toBeNull();
  });

  it("leaves a busy desk to fill its own page", () => {
    const { container } = render(<SectionFrontBody {...props({ front: "tech" })} />);

    expect(container.querySelector("[data-more-from-paper]")).toBeNull();
  });

  it("counts «لقطة وتعليق» by its videos, not by its article list", () => {
    // The watch desk keeps its stories in the video table, so counting
    // articles would call a full desk empty and hang the rail under it.
    const videos = { count: 8, next: null, previous: null, results: Array.from({ length: 8 }, (_, i) => ({ id: i })) };
    const { container } = render(
      <SectionFrontBody {...props({ front: "watch", stories: [], feeds: { videos } })} />,
    );

    expect(container.querySelector("[data-more-from-paper]")).toBeNull();
  });

  it("keeps the rail away when there is nothing to put in it", () => {
    const { container } = render(<SectionFrontBody {...props({ front: "tech", stories: [story(1)], more: [] })} />);

    expect(container.querySelector("[data-more-from-paper]")).toBeNull();
  });

  it("treats a watch desk with no videos as thin however many articles it has", () => {
    const { container } = render(
      <SectionFrontBody {...props({ front: "watch", feeds: { videos: null } })} />,
    );

    expect(container.querySelector("[data-more-from-paper]")).not.toBeNull();
  });
});
