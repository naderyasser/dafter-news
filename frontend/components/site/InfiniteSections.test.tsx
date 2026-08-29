import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import InfiniteSections from "./InfiniteSections";
import type { Section } from "@/lib/types";

vi.mock("next/image", () => ({
  default: ({ src, alt, fill, priority, sizes, ...rest }: any) => <img src={typeof src === "string" ? src : ""} alt={alt} {...rest} />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const sections: Section[] = [
  { id: 1, key: "egypt", name_ar: "شؤون مصر", name_en: "Egypt", order: 1, article_count: 9, cover_image: null, tagline: "" },
  { id: 2, key: "sports", name_ar: "جوّه الجون", name_en: "Sports", order: 2, article_count: 4, cover_image: null, tagline: "" },
];

const article = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  title: `خبر ${id}`,
  slug: `khabar-${id}`,
  cover_image: `/media/covers/${id}.jpg`,
  standfirst: `مقدمة ${id}`,
  published_at: "2026-08-17T09:00:00Z",
  section_name: "شؤون مصر",
  badge: "none",
  ...over,
});

/** The component only fetches once its sentinel is seen, so the observer has
 *  to report an intersection for anything to happen at all. */
function observeImmediately() {
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
}

function stubFetch(byKey: Record<string, unknown[]>) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      calls.push(String(url));
      const key = /section__key=([^&]+)/.exec(String(url))?.[1] ?? "";
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ results: byKey[key] ?? [] }),
      } as Response);
    }),
  );
  return calls;
}

describe("InfiniteSections", () => {
  beforeEach(observeImmediately);
  afterEach(() => vi.unstubAllGlobals());

  it("appends a section panel once the reader reaches the end of the article", async () => {
    stubFetch({ egypt: [article(1), article(2), article(3), article(4)] });

    render(<InfiniteSections lang="ar" sections={sections} />);

    expect(await screen.findByRole("heading", { level: 2, name: "شؤون مصر" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "خبر 1" })).toBeInTheDocument();
  });

  it("leads with a photo and standfirst, and keeps three rows behind it", async () => {
    // A lead plus rows, not four identical cards: the panel needs a shape or
    // it reads as wallpaper by the third section down the page.
    stubFetch({ egypt: [article(1), article(2), article(3), article(4), article(5)] });

    render(<InfiniteSections lang="ar" sections={sections} />);

    await screen.findByRole("heading", { name: "شؤون مصر" });
    expect(screen.getByText("مقدمة 1")).toBeInTheDocument();
    // Four kept out of the five fetched — the fifth is dropped.
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    expect(screen.queryByRole("heading", { name: "خبر 5" })).not.toBeInTheDocument();
  });

  it("never offers the article the reader is already on", async () => {
    stubFetch({ egypt: [article(1), article(2), article(3)] });

    render(<InfiniteSections lang="ar" sections={sections} excludeSlug="khabar-2" />);

    await screen.findByRole("heading", { name: "شؤون مصر" });
    expect(screen.queryByRole("heading", { name: "خبر 2" })).not.toBeInTheDocument();
  });

  it("skips a section with nothing in it rather than printing a bare heading", async () => {
    stubFetch({ egypt: [], sports: [article(9, { section_name: "جوّه الجون" })] });

    render(<InfiniteSections lang="ar" sections={sections} />);

    await waitFor(() => expect(screen.queryByRole("heading", { name: "جوّه الجون" })).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "شؤون مصر" })).not.toBeInTheDocument();
  });

  it("asks for the reader's own language, not always Arabic", async () => {
    // regression: the fetch hardcoded language=ar, so an English article
    // appended Arabic sections under English headings.
    const calls = stubFetch({ egypt: [article(1)] });

    render(<InfiniteSections lang="en" sections={sections} />);

    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(calls[0]).toContain("language=en");
    expect(calls[0]).not.toContain("language=ar");
  });

  it("keeps its links inside the reader's own edition", async () => {
    // regression: /article/… from the English edition drops the reader into
    // the Arabic page mid-read.
    stubFetch({ egypt: [article(1), article(2)] });

    render(<InfiniteSections lang="en" sections={sections} />);

    const heading = await screen.findByRole("heading", { level: 3, name: "خبر 1" });
    expect(heading.closest("a")).toHaveAttribute("href", "/en/article/khabar-1");
    expect(screen.getByRole("link", { name: /See all/ })).toHaveAttribute("href", "/en/section/egypt");
  });

  it("orders every appended section newest-first", async () => {
    const calls = stubFetch({ egypt: [article(1)] });

    render(<InfiniteSections lang="ar" sections={sections} />);

    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(calls[0]).toContain("ordering=-published_at");
  });

  it("stops appending instead of looping when the API goes down", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));

    render(<InfiniteSections lang="ar" sections={sections} />);

    // No panel, no crash, and the back-home link is what a reader is left with.
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("renders nothing at all when there are no sections to append", () => {
    stubFetch({});

    const { container } = render(<InfiniteSections lang="ar" sections={[]} />);

    expect(container.querySelectorAll("section")).toHaveLength(0);
  });

  it("carries each section's own colour into its panel", async () => {
    stubFetch({ egypt: [article(1)] });

    render(<InfiniteSections lang="ar" sections={sections} />);

    const heading = await screen.findByRole("heading", { level: 2, name: "شؤون مصر" });
    expect(heading.getAttribute("style")).toContain("--rule-b");
  });
});
