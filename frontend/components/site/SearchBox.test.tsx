import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SearchBox from "./SearchBox";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("next/image", () => ({
  default: ({ src, alt, fill, sizes, ...rest }: any) => <img src={typeof src === "string" ? src : ""} alt={alt} {...rest} />,
}));

/** The search effect debounces by 0/180ms; settle past either. */
const settle = async (ms = 250) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

describe("SearchBox error retry", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    push.mockClear();
  });

  it("actually retries the search instead of a no-op state update", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    render(<SearchBox lang="ar" />);
    fireEvent.click(screen.getByLabelText("بحث"));
    await settle(50);

    expect(screen.getByText("تعذّر الوصول إلى نتائج البحث.")).toBeInTheDocument();
    const callsBeforeRetry = fetchMock.mock.calls.length;
    expect(callsBeforeRetry).toBeGreaterThan(0);

    // Same query as before the failure — setQuery(q => q) alone would be an
    // Object.is no-op that never retriggers the load effect.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 0, next: null, previous: null, results: [] }),
    });
    fireEvent.click(screen.getByText("أعد المحاولة"));
    await settle(50);

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
  });
});

describe("SearchBox routing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 0, next: null, previous: null, results: [] }) }),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    push.mockClear();
  });

  it("sends the English edition's search to /en/search, not the Arabic-only /search", async () => {
    // regression: submit() hardcoded `/search` regardless of `lang` (unlike
    // articleBase two lines above it, which does branch on lang), so an
    // English reader who pressed Enter with no row highlighted landed on the
    // Arabic-only /search page.
    render(<SearchBox lang="en" />);
    fireEvent.click(screen.getByLabelText("Search"));
    fireEvent.change(screen.getByPlaceholderText("Search for a story, writer or section"), { target: { value: "delta" } });
    await settle(250);

    fireEvent.keyDown(screen.getByPlaceholderText("Search for a story, writer or section"), { key: "Enter" });

    expect(push).toHaveBeenCalledWith("/en/search?q=delta");
  });

  it("keeps the Arabic edition's search on /search", async () => {
    render(<SearchBox lang="ar" />);
    fireEvent.click(screen.getByLabelText("بحث"));
    fireEvent.change(screen.getByPlaceholderText("ابحث عن خبر، كاتب، أو قسم"), { target: { value: "دلتا" } });
    await settle(250);

    fireEvent.keyDown(screen.getByPlaceholderText("ابحث عن خبر، كاتب، أو قسم"), { key: "Enter" });

    expect(push).toHaveBeenCalledWith(`/search?q=${encodeURIComponent("دلتا")}`);
  });

  it("points the footer 'see all results' link at the edition's own search page", () => {
    // regression: this Link hardcoded href="/search" regardless of lang.
    const { unmount } = render(<SearchBox lang="en" />);
    fireEvent.click(screen.getByLabelText("Search"));
    expect(screen.getByText("See all results").closest("a")).toHaveAttribute("href", "/en/search");
    unmount();

    render(<SearchBox lang="ar" />);
    fireEvent.click(screen.getByLabelText("بحث"));
    expect(screen.getByText("عرض كل النتائج").closest("a")).toHaveAttribute("href", "/search");
  });
});

describe("SearchBox — Enter means search unless a row was deliberately picked", () => {
  beforeEach(() => {
    // jsdom stops at layout; the highlight-follows-cursor effect calls this.
    Element.prototype.scrollIntoView = () => {};
  });

  const rows = [
    { id: 1, slug: "first-hit", title: "أول نتيجة", section_name: "شؤون مصر", published_at: null, badge: "none", cover_image: null },
    { id: 2, slug: "second-hit", title: "ثاني نتيجة", section_name: "شؤون مصر", published_at: null, badge: "none", cover_image: null },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 2, next: null, previous: null, results: rows }) }),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    push.mockClear();
  });

  const field = () => screen.getByPlaceholderText("ابحث عن خبر، كاتب، أو قسم");
  const openAndType = async (q: string) => {
    render(<SearchBox lang="ar" />);
    fireEvent.click(screen.getByLabelText("بحث"));
    fireEvent.change(field(), { target: { value: q } });
    await settle(250);
  };

  it("goes to the results page on plain type-and-Enter, even with suggestions showing", async () => {
    // The cursor rests on the first suggestion by default. Enter used to
    // open it — typing «مصر» ⏎ landed inside whatever article ranked first
    // instead of the results page the reader asked for.
    await openAndType("مصر");

    fireEvent.keyDown(field(), { key: "Enter" });

    expect(push).toHaveBeenCalledWith(`/search?q=${encodeURIComponent("مصر")}`);
  });

  it("opens the highlighted article when the reader arrowed onto it", async () => {
    await openAndType("مصر");

    fireEvent.keyDown(field(), { key: "ArrowDown" });
    fireEvent.keyDown(field(), { key: "Enter" });

    expect(push).toHaveBeenCalledWith("/article/second-hit");
  });

  it("arrowing down then back up still counts as a deliberate pick of the first row", async () => {
    await openAndType("مصر");

    fireEvent.keyDown(field(), { key: "ArrowDown" });
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    fireEvent.keyDown(field(), { key: "Enter" });

    expect(push).toHaveBeenCalledWith("/article/first-hit");
  });

  it("a refined query resets the pick — Enter searches again", async () => {
    await openAndType("مصر");
    fireEvent.keyDown(field(), { key: "ArrowDown" });

    // New keystrokes → new results → the old highlight no longer speaks for
    // the reader's intent.
    fireEvent.change(field(), { target: { value: "مصر الاقتصاد" } });
    await settle(250);
    fireEvent.keyDown(field(), { key: "Enter" });

    // URLSearchParams encodes the space as "+", not "%20".
    expect(push).toHaveBeenCalledWith(`/search?${new URLSearchParams({ q: "مصر الاقتصاد" })}`);
  });
});

describe("SearchBox result thumbnails", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = () => {};
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          count: 1,
          next: null,
          previous: null,
          results: [
            { id: 1, slug: "with-cover", title: "خبر بصورة", section_name: "شؤون مصر", published_at: null, badge: "none", cover_image: "/media/covers/x.jpg" },
          ],
        }),
      }),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    push.mockClear();
  });

  it("keeps the fill image caged in a positioned thumbnail box", async () => {
    // Regression: the 58px thumb span had no `relative`, so the fill image
    // anchored to the modal itself — one cover stretched over the whole
    // search panel, burying the field and every result under a blurry photo.
    const { baseElement } = render(<SearchBox lang="ar" />);
    fireEvent.click(screen.getByLabelText("بحث"));
    await settle(250);

    // alt="" makes the thumb role=presentation, so query by tag.
    const img = baseElement.querySelector("img") as HTMLElement;
    expect(img).not.toBeNull();
    const box = img.parentElement as HTMLElement;
    expect(box.className).toContain("relative");
    expect(box.className).toContain("w-[58px]");
  });
});
