import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StoryViewer, { STORY_MS } from "./StoryViewer";
import type { Story } from "@/lib/types";

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

const three = [story(), story({ id: 2, title: "قرار الفائدة" }), story({ id: 3, title: "مباراة القمة" })];

describe("StoryViewer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("opens on the story it was handed, not on the first", () => {
    render(<StoryViewer lang="ar" stories={three} startAt={1} onClose={() => {}} />);

    expect(screen.getByText("قرار الفائدة")).toBeInTheDocument();
  });

  it("draws one timer segment per story", () => {
    // The segmented bar is what tells a reader how much of the set is left —
    // a single bar would say only how much of the current story is left.
    const { baseElement } = render(<StoryViewer lang="ar" stories={three} startAt={0} onClose={() => {}} />);

    expect(baseElement.querySelectorAll(".animate-story-fill")).toHaveLength(1);
    expect(within(screen.getByRole("dialog")).getAllByLabelText(/التالي|السابق/)).toHaveLength(2);
  });

  it("advances on its own once the dwell elapses", () => {
    render(<StoryViewer lang="ar" stories={three} startAt={0} onClose={() => {}} />);

    act(() => {
      vi.advanceTimersByTime(STORY_MS + 50);
    });

    expect(screen.getByText("قرار الفائدة")).toBeInTheDocument();
  });

  it("closes past the last story rather than looping", () => {
    // A hero carousel has no end state and should loop; a story set does, and
    // trapping the reader in it turns the feature into a lightbox to escape.
    const onClose = vi.fn();
    render(<StoryViewer lang="ar" stories={three} startAt={2} onClose={onClose} />);

    act(() => {
      vi.advanceTimersByTime(STORY_MS + 50);
    });

    expect(onClose).toHaveBeenCalledWith(2);
  });

  it("reports the story the reader stopped on, not the one they opened", () => {
    const onClose = vi.fn();
    render(<StoryViewer lang="ar" stories={three} startAt={0} onClose={onClose} />);

    act(() => {
      vi.advanceTimersByTime(STORY_MS + 50);
    });
    fireEvent.click(screen.getByLabelText("إغلاق"));

    expect(onClose).toHaveBeenCalledWith(1);
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<StoryViewer lang="ar" stories={three} startAt={0} onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it("follows reading direction on the arrow keys", () => {
    // regression: a fixed ArrowRight = next sends an RTL reader backwards.
    render(<StoryViewer lang="ar" stories={three} startAt={1} onClose={() => {}} />);

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("مباراة القمة")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("قرار الفائدة")).toBeInTheDocument();
  });

  it("holds the timer while the reader is pressing on the story", () => {
    render(<StoryViewer lang="ar" stories={three} startAt={0} onClose={() => {}} />);

    fireEvent.pointerDown(screen.getByText("محور الدلتا.. الصورة الكاملة"));
    act(() => {
      vi.advanceTimersByTime(STORY_MS * 2);
    });

    expect(screen.getByText("محور الدلتا.. الصورة الكاملة")).toBeInTheDocument();
  });

  it("locks the page behind it and gives the scrollbar back on close", () => {
    const { unmount } = render(<StoryViewer lang="ar" stories={three} startAt={0} onClose={() => {}} />);
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("links out to the story's destination", () => {
    render(<StoryViewer lang="ar" stories={[story({ href: "/article/delta" })]} startAt={0} onClose={() => {}} />);

    expect(screen.getByText("اقرأ الخبر").closest("a")).toHaveAttribute("href", "/article/delta");
  });

  it("uses English chrome on the English edition", () => {
    render(<StoryViewer lang="en" stories={three} startAt={0} onClose={() => {}} />);

    expect(screen.getByText("Read the story")).toBeInTheDocument();
  });
});
