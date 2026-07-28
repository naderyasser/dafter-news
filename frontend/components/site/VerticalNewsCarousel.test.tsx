import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import VerticalNewsCarousel, { type VerticalNewsItem } from "./VerticalNewsCarousel";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const item = (n: number): VerticalNewsItem => ({
  href: `/article/story-${n}`,
  title: `الخبر رقم ${n}`,
  kicker: "شؤون مصر",
  time: "منذ ساعة",
  imageSrc: null,
});

const three = [item(1), item(2), item(3)];
const track = (c: HTMLElement) => c.querySelector('[style*="translateY"]') as HTMLElement;

describe("VerticalNewsCarousel", () => {
  beforeEach(() => {
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

  it("renders nothing when there is nothing to show", () => {
    const { container } = render(<VerticalNewsCarousel lang="ar" items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps every headline in the DOM, not just the visible one", () => {
    // The frame shows one story, but all of them must stay in the served HTML
    // so a crawler and in-page find still see the whole block.
    render(<VerticalNewsCarousel lang="ar" items={three} />);

    expect(screen.getByText("الخبر رقم 1")).toBeInTheDocument();
    expect(screen.getByText("الخبر رقم 3")).toBeInTheDocument();
  });

  it("moves vertically, not horizontally", () => {
    // The whole request was «عمودياً» — a translateX here would be the bug.
    const { container } = render(<VerticalNewsCarousel lang="ar" items={three} />);

    expect(track(container).style.transform).toBe("translateY(-0%)");
    expect(track(container).style.transform).not.toContain("translateX");
  });

  it("advances on its own", () => {
    const { container } = render(<VerticalNewsCarousel lang="ar" items={three} />);

    act(() => {
      vi.advanceTimersByTime(6100);
    });

    expect(track(container).style.transform).toBe("translateY(-100%)");
    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("stops while the pointer is over it", () => {
    const { container } = render(<VerticalNewsCarousel lang="ar" items={three} />);
    fireEvent.mouseEnter(container.querySelector('[aria-roledescription="carousel"]')!);

    act(() => {
      vi.advanceTimersByTime(12500);
    });

    expect(track(container).style.transform).toBe("translateY(-0%)");
  });

  it("jumps to a story from its dot", () => {
    const { container } = render(<VerticalNewsCarousel lang="ar" items={three} />);

    fireEvent.click(screen.getByLabelText("خبر 3"));

    expect(track(container).style.transform).toBe("translateY(-200%)");
  });

  it("wraps around at both ends", () => {
    const { container } = render(<VerticalNewsCarousel lang="ar" items={three} />);

    fireEvent.click(screen.getByLabelText("السابق"));
    expect(track(container).style.transform).toBe("translateY(-200%)");

    fireEvent.click(screen.getByLabelText("التالي"));
    expect(track(container).style.transform).toBe("translateY(-0%)");
  });

  it("takes off-screen slides out of the tab order", () => {
    render(<VerticalNewsCarousel lang="ar" items={three} />);

    const links = screen.getAllByRole("link", { hidden: true });
    expect(links[0]).not.toHaveAttribute("tabindex", "-1");
    expect(links[1]).toHaveAttribute("tabindex", "-1");
  });

  it("shows the live tag only when a stream is actually running", () => {
    const { rerender } = render(<VerticalNewsCarousel lang="ar" items={three} />);
    expect(screen.queryByText("مباشر")).not.toBeInTheDocument();

    rerender(<VerticalNewsCarousel lang="ar" items={three} isLive />);
    expect(screen.getByText("مباشر")).toBeInTheDocument();
  });

  it("hides the controls for a single story", () => {
    render(<VerticalNewsCarousel lang="ar" items={[item(1)]} />);

    expect(screen.queryByLabelText("التالي")).not.toBeInTheDocument();
  });

  it("uses English chrome on the English edition", () => {
    render(<VerticalNewsCarousel lang="en" items={three} isLive />);

    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByLabelText("Next")).toBeInTheDocument();
  });
});
