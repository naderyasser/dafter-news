import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StoriesRail, { MAX_STORIES } from "./StoriesRail";
import { STORY_MS } from "./StoryViewer";
import type { Story } from "@/lib/types";

vi.mock("next/image", () => ({
  // The real component rewrites src through /_next/image; these tests assert
  // on the upstream path, so render a bare img with the same props.
  default: ({ src, alt, fill, priority, sizes, ...rest }: any) => <img src={typeof src === "string" ? src : ""} alt={alt} {...rest} />,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const story = (over: Partial<Story> = {}): Story => ({
  id: 1,
  title: "محور الدلتا.. الصورة الكاملة",
  image: null,
  href: "/section/egypt",
  section: 1,
  section_name: "شؤون مصر",
  active: true,
  order: 1,
  ...over,
});

describe("StoriesRail", () => {
  it("renders one card per story", () => {
    render(<StoriesRail lang="ar" stories={[story(), story({ id: 2, title: "قرار الفائدة" })]} />);

    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getByText("قرار الفائدة")).toBeInTheDocument();
  });

  it("never shows more than ten cards, however many it is handed", () => {
    const many = Array.from({ length: 25 }, (_, i) => story({ id: i + 1, title: `قصة ${i + 1}` }));

    render(<StoriesRail lang="ar" stories={many} />);

    expect(screen.getAllByRole("link")).toHaveLength(MAX_STORIES);
    expect(screen.getAllByRole("link")).toHaveLength(10);
    // The first ten — the newest, since the API hands them over
    // newest-first — not a slice from somewhere in the middle.
    expect(screen.getByText("قصة 1")).toBeInTheDocument();
    expect(screen.queryByText("قصة 11")).not.toBeInTheDocument();
  });

  it("counts the capped list, not the list it was given", () => {
    // «1/10», never «1/25» — the counter and the rail have to agree.
    const many = Array.from({ length: 25 }, (_, i) => story({ id: i + 1, title: `قصة ${i + 1}` }));

    render(<StoriesRail lang="ar" stories={many} />);

    expect(screen.getByText("1/10")).toBeInTheDocument();
  });

  it("shows the section label on the card", () => {
    render(<StoriesRail lang="ar" stories={[story()]} />);

    expect(screen.getByText("شؤون مصر")).toBeInTheDocument();
  });

  it("renders nothing at all when there are no stories", () => {
    // An empty rail would otherwise leave a stranded heading and padding.
    const { container } = render(<StoriesRail lang="ar" stories={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("scrolls horizontally rather than wrapping", () => {
    const { container } = render(<StoriesRail lang="ar" stories={[story()]} />);

    const track = container.querySelector(".overflow-x-auto");
    expect(track).not.toBeNull();
    expect(track?.className).toContain("snap-x");
  });

  it("uses tall portrait cards, sized explicitly rather than by ratio", () => {
    // regression (iOS): the card carried `aspect-[9/16]` while being both a
    // flex item and a flex container — the one place on the page with that
    // combination. WebKit resolves it unreliably, and a card that loses its
    // height collapses onto its neighbours, which is the "jumbled" rail
    // reported on iPhone. The width was already fixed at both breakpoints,
    // so 128×228 / 142×252 is the same design with nothing left to resolve.
    const { container } = render(<StoriesRail lang="ar" stories={[story()]} />);

    const card = container.querySelector("a")!;
    expect(card.className).toContain("h-[228px]");
    expect(card.className).toContain("w-[128px]");
    expect(card.className).toContain("sm:h-[252px]");
    expect(card.className).toContain("sm:w-[142px]");
    expect(card.className).not.toContain("aspect-");
  });

  it("keeps every card at its declared size on a narrow screen", () => {
    // flex-shrink-0 is what stops five cards squeezing to fit a phone.
    const { container } = render(<StoriesRail lang="ar" stories={[story(), story({ id: 2 })]} />);

    for (const card of container.querySelectorAll("a")) {
      expect(card.className).toContain("flex-shrink-0");
    }
  });

  it("does not let the row stretch its cards", () => {
    // align-items: stretch is what WebKit resolves ahead of the card's own
    // height; nothing in this rail wants it — every card is one size.
    const { container } = render(<StoriesRail lang="ar" stories={[story()]} />);

    expect(container.querySelector(".overflow-x-auto")!.className).toContain("items-start");
  });

  it("keeps a flick past the end of the rail from triggering Safari's back-swipe", () => {
    const { container } = render(<StoriesRail lang="ar" stories={[story()]} />);

    expect(container.querySelector(".overflow-x-auto")!.className).toContain("overscroll-x-contain");
  });

  it("falls back to # when a story has no destination", () => {
    render(<StoriesRail lang="ar" stories={[story({ href: "" })]} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "#");
  });

  it("renders the image when one is set", () => {
    // alt="" is deliberate — the card's title carries the meaning, so the
    // image is decorative and stays out of the accessibility tree (which is
    // why this queries the DOM rather than role="img").
    const { container } = render(<StoriesRail lang="ar" stories={[story({ image: "/media/stories/a.jpg" })]} />);

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain("/media/stories/a.jpg");
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("uses the English heading in English", () => {
    render(<StoriesRail lang="en" stories={[story()]} />);

    expect(screen.getByText("Today's top stories")).toBeInTheDocument();
  });
});

describe("StoriesRail — auto-advance", () => {
  const three = [story(), story({ id: 2, title: "قرار الفائدة" }), story({ id: 3, title: "مباراة القمة" })];

  beforeEach(() => {
    // The rail refuses to advance while it is off screen, so the observer has
    // to report it as visible before any timer behaviour can be exercised.
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(private cb: (e: { isIntersecting: boolean }[]) => void) {}
        observe() {
          this.cb([{ isIntersecting: true }]);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows which story the timer is counting, in text", () => {
    render(<StoriesRail lang="ar" stories={three} />);

    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("flips to the next story once the dwell elapses", () => {
    render(<StoriesRail lang="ar" stories={three} />);

    act(() => {
      vi.advanceTimersByTime(STORY_MS + 50);
    });

    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("wraps back to the first story after the last", () => {
    render(<StoriesRail lang="ar" stories={three} />);

    // One act() per flip on purpose: the next timer is only scheduled by the
    // effect that runs after the previous flip commits, so advancing 3×STORY_MS
    // inside a single act() would still only move the rail one story.
    for (const expected of ["2/3", "3/3", "1/3"]) {
      act(() => {
        vi.advanceTimersByTime(STORY_MS + 50);
      });
      expect(screen.getByText(expected)).toBeInTheDocument();
    }
  });

  it("stops advancing while the pointer is inside the rail", () => {
    // regression: a rail that keeps moving under the cursor makes the card
    // being aimed at unclickable.
    const { container } = render(<StoriesRail lang="ar" stories={three} />);
    const track = container.querySelector(".overflow-x-auto") as HTMLElement;

    fireEvent.mouseEnter(track);
    act(() => {
      vi.advanceTimersByTime(STORY_MS * 2);
    });

    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("never advances a single-story rail", () => {
    render(<StoriesRail lang="ar" stories={[story()]} />);

    act(() => {
      vi.advanceTimersByTime(STORY_MS * 4);
    });

    expect(screen.getByText("1/1")).toBeInTheDocument();
  });

  it("opens the full-screen viewer instead of navigating when a card is tapped", () => {
    render(<StoriesRail lang="ar" stories={three} />);

    fireEvent.click(screen.getByText("قرار الفائدة"));

    const viewer = screen.getByRole("dialog");
    expect(viewer).toBeInTheDocument();
    // Opened on the card that was tapped, not on the first one.
    expect(within(viewer).getByText("قرار الفائدة")).toBeInTheDocument();
  });
});
