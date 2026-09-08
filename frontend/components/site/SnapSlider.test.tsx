import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SnapSlider from "./SnapSlider";

/**
 * jsdom has no layout, so the track's geometry is stubbed per test: a 1200px
 * track in a 400px viewport with 400px slots (gap 0) is three pages. The
 * paging arithmetic is the whole component, and it is direction-sensitive,
 * which is what breaks silently on an RTL page.
 */
function stubTrack({ scrollLeft = 0, scrollWidth = 1200, clientWidth = 400, slot = 400 } = {}) {
  const track = document.querySelector<HTMLElement>(".snap-x")!;
  Object.defineProperty(track, "scrollWidth", { value: scrollWidth, configurable: true });
  Object.defineProperty(track, "clientWidth", { value: clientWidth, configurable: true });
  Object.defineProperty(track, "scrollLeft", { value: scrollLeft, writable: true, configurable: true });
  const first = track.firstElementChild as HTMLElement;
  Object.defineProperty(first, "offsetWidth", { value: slot, configurable: true });
  track.scrollTo = vi.fn();
  return track;
}

const items = ["أ", "ب", "ج"].map((t) => <div key={t}>{t}</div>);

describe("SnapSlider", () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any;
  });

  it("wraps each child in its own snap slot", () => {
    render(
      <SnapSlider lang="ar" itemClassName="w-full" ariaLabel="ثقافة وفن">
        {items}
      </SnapSlider>,
    );

    expect(document.querySelectorAll(".snap-start")).toHaveLength(3);
    expect(screen.getByRole("region", { name: "ثقافة وفن" })).toBeInTheDocument();
  });

  it("derives one indicator per page and scrolls to the chosen one", () => {
    render(
      <SnapSlider lang="ar" itemClassName="w-full" ariaLabel="ثقافة وفن">
        {items}
      </SnapSlider>,
    );
    const track = stubTrack();
    act(() => {
      fireEvent.scroll(track);
    });

    expect(screen.getAllByRole("tab")).toHaveLength(3);
    fireEvent.click(screen.getByRole("tab", { name: /3/ }));
    // Arabic: forward travel is a NEGATIVE scrollLeft.
    expect(track.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: -800 }));
  });

  it("scrolls toward the positive edge in English", () => {
    render(
      <SnapSlider lang="en" itemClassName="w-full" ariaLabel="Culture">
        {items}
      </SnapSlider>,
    );
    const track = stubTrack();
    act(() => {
      fireEvent.scroll(track);
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(track.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 400 }));
  });

  it("disables the back arrow at the start and the forward arrow at the end", () => {
    render(
      <SnapSlider lang="ar" itemClassName="w-full" ariaLabel="ثقافة وفن">
        {items}
      </SnapSlider>,
    );
    const track = stubTrack();
    act(() => {
      fireEvent.scroll(track);
    });
    expect(screen.getByRole("button", { name: "السابق" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "التالي" })).toBeEnabled();

    track.scrollLeft = -800;
    act(() => {
      fireEvent.scroll(track);
    });
    expect(screen.getByRole("button", { name: "التالي" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "السابق" })).toBeEnabled();
  });

  it("renders the heading on the same row as the arrows", () => {
    render(
      <SnapSlider lang="ar" itemClassName="w-full" ariaLabel="ثقافة وفن" heading={<h2>ثقافة وفن</h2>}>
        {items}
      </SnapSlider>,
    );

    const heading = screen.getByRole("heading", { name: "ثقافة وفن" });
    const next = screen.getByRole("button", { name: "التالي" });
    expect(heading.parentElement?.parentElement).toBe(next.parentElement?.parentElement);
  });

  it("shows no arrows or indicators for a single slide", () => {
    render(
      <SnapSlider lang="ar" itemClassName="w-full" ariaLabel="ثقافة وفن">
        <div>وحيد</div>
      </SnapSlider>,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("renders nothing at all with no slides", () => {
    const { container } = render(
      <SnapSlider lang="ar" itemClassName="w-full" ariaLabel="ثقافة وفن">
        {[]}
      </SnapSlider>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("auto-advances on a timer and wraps back to the first page", () => {
    vi.useFakeTimers();
    try {
      render(
        <SnapSlider lang="en" itemClassName="w-full" ariaLabel="Columns" autoplayMs={1000}>
          {items}
        </SnapSlider>,
      );
      const track = stubTrack({ scrollLeft: 800 });
      act(() => {
        fireEvent.scroll(track);
      });
      // On the last page: the next tick goes home rather than off the end.
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(track.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 0 }));
    } finally {
      vi.useRealTimers();
    }
  });
});
