import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ArrowCarousel from "./ArrowCarousel";

/**
 * jsdom has no layout: scrollWidth/clientWidth are 0 and scrollBy does
 * nothing. The rail's whole job is arithmetic over those numbers, so they are
 * defined here per test rather than mocked away — that arithmetic is what the
 * two live carousels («ثقافة وفن» and «علوم وتكنولوجيا») depend on, and it is
 * direction-sensitive, which is exactly the kind of thing that breaks silently
 * on an RTL page.
 */
function stubTrack({ scrollLeft = 0, scrollWidth = 1200, clientWidth = 400 } = {}) {
  const track = document.querySelector<HTMLElement>(".snap-x")!;
  Object.defineProperty(track, "scrollWidth", { value: scrollWidth, configurable: true });
  Object.defineProperty(track, "clientWidth", { value: clientWidth, configurable: true });
  Object.defineProperty(track, "scrollLeft", { value: scrollLeft, writable: true, configurable: true });
  track.scrollBy = vi.fn();
  return track;
}

const items = ["أ", "ب", "ج", "د"].map((t) => <div key={t}>{t}</div>);

describe("ArrowCarousel", () => {
  beforeEach(() => {
    // scrollBy is unimplemented in jsdom and warns on every call.
    Element.prototype.scrollBy = vi.fn();
  });

  it("wraps each child in its own snap slot", () => {
    render(<ArrowCarousel lang="ar">{items}</ArrowCarousel>);

    expect(screen.getByText("أ")).toBeInTheDocument();
    expect(document.querySelectorAll(".snap-start")).toHaveLength(4);
  });

  it("scrolls toward the start edge in Arabic and the end edge in English", async () => {
    const { unmount } = render(<ArrowCarousel lang="ar">{items}</ArrowCarousel>);
    let track = stubTrack();
    await act(async () => fireEvent.scroll(track));
    await act(async () => screen.getByLabelText("التالي").click());

    // RTL: "next" is further left, so scrollLeft must decrease.
    expect(track.scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: -340 }));
    unmount();

    render(<ArrowCarousel lang="en">{items}</ArrowCarousel>);
    track = stubTrack();
    await act(async () => fireEvent.scroll(track));
    await act(async () => screen.getByLabelText("Next").click());

    expect(track.scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 340 }));
  });

  it("disables the back arrow at the start and the forward arrow at the end", async () => {
    render(<ArrowCarousel lang="ar">{items}</ArrowCarousel>);
    const track = stubTrack({ scrollLeft: 0 });
    await act(async () => fireEvent.scroll(track));

    expect(screen.getByLabelText("السابق")).toBeDisabled();
    expect(screen.getByLabelText("التالي")).toBeEnabled();

    // scrollWidth 1200 - clientWidth 400 = 800 is the far end.
    (track as unknown as { scrollLeft: number }).scrollLeft = 800;
    await act(async () => fireEvent.scroll(track));

    expect(screen.getByLabelText("التالي")).toBeDisabled();
    expect(screen.getByLabelText("السابق")).toBeEnabled();
  });

  it("reads a negative scrollLeft as distance travelled, the way RTL engines report it", async () => {
    render(<ArrowCarousel lang="ar">{items}</ArrowCarousel>);
    // Firefox and WebKit count RTL scroll offsets down from zero. Treated as
    // a raw number instead of a distance, -800 reads as "before the start"
    // and both arrows end up wrong at once.
    const track = stubTrack({ scrollLeft: -800 });
    await act(async () => fireEvent.scroll(track));

    expect(screen.getByLabelText("التالي")).toBeDisabled();
    expect(screen.getByLabelText("السابق")).toBeEnabled();
  });

  it("disables both arrows when everything already fits", async () => {
    render(<ArrowCarousel lang="ar">{items}</ArrowCarousel>);
    const track = stubTrack({ scrollWidth: 400, clientWidth: 400 });
    await act(async () => fireEvent.scroll(track));

    expect(screen.getByLabelText("السابق")).toBeDisabled();
    expect(screen.getByLabelText("التالي")).toBeDisabled();
  });
});
