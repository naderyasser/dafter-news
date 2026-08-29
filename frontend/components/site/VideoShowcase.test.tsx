import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import VideoShowcase, { type ShowcaseVideo } from "./VideoShowcase";

const videos: ShowcaseVideo[] = [
  {
    id: 1,
    href: "/video/one",
    title: "جولة داخل أكبر مصنع سيارات كهربائية",
    description: "تقرير مصوّر من داخل المصنع.",
    poster: "/media/one.jpg",
    externalUrl: "https://www.youtube.com/watch?v=abc123",
    durationLabel: "07:20",
    views: 1234,
    comments: 8,
    time: "منذ ساعة",
  },
  {
    id: 2,
    href: "/video/two",
    title: "ملخص مباراة الأهلي والترجي",
    poster: "/media/two.jpg",
    durationLabel: "04:10",
  },
  {
    id: 3,
    href: "/video/three",
    title: "فيديو بلا غلاف",
  },
];

beforeAll(() => {
  // jsdom stops at layout, so the strip's scroll-into-view never resolves.
  Element.prototype.scrollIntoView = () => {};
});

describe("VideoShowcase", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when there are no videos", () => {
    const { container } = render(<VideoShowcase lang="ar" title="لقطة وتعليق" href="/video" videos={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("stages the first video and lists every one in the strip", () => {
    render(<VideoShowcase lang="ar" title="لقطة وتعليق" href="/video" videos={videos} />);

    // The staged title is a link to the video; the strip repeats each title
    // inside its tab, so both are present — getAllByText covers the pair.
    expect(screen.getAllByText(videos[0].title).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(videos[0].title);
  });

  it("swaps the stage when a thumbnail is clicked", async () => {
    render(<VideoShowcase lang="ar" title="لقطة وتعليق" href="/video" videos={videos} />);

    await act(async () => screen.getAllByRole("tab")[2].click());

    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(videos[2].title);
    expect(screen.getByRole("link", { name: "شاهد الفيديو كاملاً" })).toHaveAttribute("href", "/video/three");
  });

  it("advances and wraps with the arrows", async () => {
    render(<VideoShowcase lang="ar" title="لقطة وتعليق" href="/video" videos={videos} />);

    await act(async () => screen.getByLabelText("الفيديو التالي").click());
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(videos[1].title);

    // Backwards past the first item lands on the last, not on nothing.
    await act(async () => screen.getByLabelText("الفيديو السابق").click());
    await act(async () => screen.getByLabelText("الفيديو السابق").click());
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(videos[2].title);
  });

  it("does not carry playback across a switch", async () => {
    render(<VideoShowcase lang="ar" title="لقطة وتعليق" href="/video" videos={videos} />);

    // Video 1 has an embeddable source, so the stage offers a play control.
    await act(async () => screen.getByLabelText(`تشغيل: ${videos[0].title}`).click());
    expect(screen.getByTitle(videos[0].title)).toBeInTheDocument();

    await act(async () => screen.getByLabelText("الفيديو التالي").click());

    // The iframe is gone rather than still playing behind the new poster.
    expect(screen.queryByTitle(videos[0].title)).not.toBeInTheDocument();
  });

  it("mirrors the arrow keys for Arabic", async () => {
    const { container } = render(<VideoShowcase lang="ar" title="لقطة وتعليق" href="/video" videos={videos} />);
    const section = container.querySelector("section")!;

    // In RTL, ArrowLeft is onward.
    await act(async () => {
      fireEvent.keyDown(section, { key: "ArrowLeft" });
    });

    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(videos[1].title);
  });

  it("mirrors the arrow keys the other way for English", async () => {
    const { container } = render(<VideoShowcase lang="en" title="Watch" href="/video" videos={videos} />);
    const section = container.querySelector("section")!;

    await act(async () => {
      fireEvent.keyDown(section, { key: "ArrowRight" });
    });

    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(videos[1].title);
  });

  it("hides the arrows and the strip for a single video", () => {
    render(<VideoShowcase lang="ar" title="لقطة وتعليق" href="/video" videos={videos.slice(0, 1)} />);

    expect(screen.queryByLabelText("الفيديو التالي")).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("keeps a coverless placeholder off the stage without hiding it", () => {
    // What the dashboard actually produces: a just-saved video with neither a
    // cover nor a source, newest-first out of the API.
    const placeholder: ShowcaseVideo = { id: 9, href: "/video/new", title: "فيديو تجريبي" };
    render(<VideoShowcase lang="ar" title="لقطة وتعليق" href="/video" videos={[placeholder, ...videos]} />);

    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(videos[0].title);
    // Still present for the editor who published it — just not leading. It
    // sinks behind everything with a cover, alongside the other sourceless
    // row, and keeps its incoming order among those.
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    // Substring, not equality: a tile's text also carries its duration badge.
    [videos[0].title, videos[1].title, "فيديو تجريبي", videos[2].title].forEach((expected, i) =>
      expect(tabs[i]).toHaveTextContent(expected),
    );
  });

  it("labels its controls in English on the English edition", () => {
    render(<VideoShowcase lang="en" title="Watch" href="/video" videos={videos} />);

    expect(screen.getByLabelText("Next video")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Watch the full video" })).toBeInTheDocument();
  });

  it("auto-advances on a timer", async () => {
    vi.useFakeTimers();
    render(<VideoShowcase lang="ar" title="لقطة وتعليق" href="/video" videos={videos} />);

    await act(async () => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(videos[1].title);
  });

  it("pauses autoplay while the stage is hovered", async () => {
    vi.useFakeTimers();
    const { container } = render(<VideoShowcase lang="ar" title="لقطة وتعليق" href="/video" videos={videos} />);
    const section = container.querySelector("section")!;

    fireEvent.mouseEnter(section);
    await act(async () => {
      vi.advanceTimersByTime(20000);
    });

    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(videos[0].title);
  });

  it("stands down once a clip is actually playing, and resumes on the next slide", async () => {
    vi.useFakeTimers();
    render(<VideoShowcase lang="ar" title="لقطة وتعليق" href="/video" videos={videos} />);

    await act(async () => screen.getByLabelText(`تشغيل: ${videos[0].title}`).click());

    // Playing the staged clip must not be interrupted by the timer.
    await act(async () => {
      vi.advanceTimersByTime(20000);
    });
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(videos[0].title);

    // Once the reader moves on themselves, the fresh slide opens on its poster
    // and autoplay is free to run again.
    await act(async () => screen.getByLabelText("الفيديو التالي").click());
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(videos[2].title);
  });
});
