import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSwipe } from "./useSwipe";

function Probe({ onSwipe, isRtl }: { onSwipe: (d: "next" | "prev") => void; isRtl: boolean }) {
  const handlers = useSwipe(onSwipe, isRtl);
  return (
    <div data-testid="track" {...handlers}>
      track
    </div>
  );
}

/** A touch gesture from (x1,y1) to (x2,y2) on the probe. */
function swipe(from: [number, number], to: [number, number]) {
  const track = screen.getByTestId("track");
  fireEvent.touchStart(track, { touches: [{ clientX: from[0], clientY: from[1] }] });
  fireEvent.touchEnd(track, { changedTouches: [{ clientX: to[0], clientY: to[1] }] });
}

/**
 * The paged carousels keep only the current page in the DOM, so a phone had
 * nothing to drag and two small arrows as the only way through. Direction is
 * the part worth pinning: it inverts between editions, and getting it
 * backwards is the kind of bug that reads as "the swipe is broken".
 */
describe("useSwipe", () => {
  it("advances on a leftward drag in English", () => {
    const onSwipe = vi.fn();
    render(<Probe onSwipe={onSwipe} isRtl={false} />);

    swipe([300, 100], [100, 100]);

    expect(onSwipe).toHaveBeenCalledWith("next");
  });

  it("goes back on a rightward drag in English", () => {
    const onSwipe = vi.fn();
    render(<Probe onSwipe={onSwipe} isRtl={false} />);

    swipe([100, 100], [300, 100]);

    expect(onSwipe).toHaveBeenCalledWith("prev");
  });

  it("inverts in Arabic — the next story sits to the LEFT", () => {
    // Matches ArrowCarousel, which advances by a negative scroll offset in
    // Arabic. A reader dragging the content rightwards is pulling the next
    // card into view.
    const onSwipe = vi.fn();
    render(<Probe onSwipe={onSwipe} isRtl />);

    swipe([100, 100], [300, 100]);

    expect(onSwipe).toHaveBeenCalledWith("next");
  });

  it("goes back on a leftward drag in Arabic", () => {
    const onSwipe = vi.fn();
    render(<Probe onSwipe={onSwipe} isRtl />);

    swipe([300, 100], [100, 100]);

    expect(onSwipe).toHaveBeenCalledWith("prev");
  });

  it("ignores a tap", () => {
    const onSwipe = vi.fn();
    render(<Probe onSwipe={onSwipe} isRtl />);

    swipe([200, 100], [205, 102]);

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("ignores a vertical scroll so the page still scrolls", () => {
    // The gesture that would otherwise be stolen: a reader flicking down the
    // page with a little horizontal drift.
    const onSwipe = vi.fn();
    render(<Probe onSwipe={onSwipe} isRtl />);

    swipe([200, 400], [150, 100]);

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("still fires on a decisively horizontal but slightly diagonal swipe", () => {
    const onSwipe = vi.fn();
    render(<Probe onSwipe={onSwipe} isRtl={false} />);

    swipe([300, 100], [100, 130]);

    expect(onSwipe).toHaveBeenCalledWith("next");
  });

  it("does not fire when the gesture never started on the track", () => {
    const onSwipe = vi.fn();
    render(<Probe onSwipe={onSwipe} isRtl />);

    fireEvent.touchEnd(screen.getByTestId("track"), { changedTouches: [{ clientX: 10, clientY: 10 }] });

    expect(onSwipe).not.toHaveBeenCalled();
  });
});
