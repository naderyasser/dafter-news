import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SearchPageContent from "./SearchPageContent";

// A result card renders through ArticleCard, which needs next/link and
// next/image stubbed outside a Next runtime (see ArticleCard.test.tsx).
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));

/** The refetch effect debounces typing by 200ms. */
const settle = async (ms = 250) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

describe("SearchPageContent error retry", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("actually retries the search instead of a no-op state update", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    render(<SearchPageContent initial={[]} initialQuery="مصر" />);

    // Change the query so the effect fires and the request fails.
    fireEvent.change(screen.getByPlaceholderText("ابحث عن خبر، كاتب، أو قسم…"), { target: { value: "مصر جديد" } });
    await settle(250);

    expect(screen.getByText("تعذّر الوصول إلى نتائج البحث.")).toBeInTheDocument();
    const callsBeforeRetry = fetchMock.mock.calls.length;
    expect(callsBeforeRetry).toBeGreaterThan(0);

    // Click retry without touching the query — setQuery(q => q) alone would
    // be an Object.is no-op that never retriggers the fetch effect.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 0, next: null, previous: null, results: [] }),
    });
    fireEvent.click(screen.getByText("أعد المحاولة"));
    await settle(250);

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
  });
});

describe("SearchPageContent lang", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("queries English articles and links to /en/article for the English edition", async () => {
    // regression: this component (and /search) used to hardcode language=ar
    // and Arabic copy/hrefs regardless of caller — there was no way for an
    // English page to reuse it.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 1, slug: "delta-bridge", title: "Delta bridge opens", section_name: "Egypt", badge: "none", cover_image: null, published_at: "2026-07-01T00:00:00Z" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SearchPageContent lang="en" initial={[]} initialQuery="delta" />);

    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search for a story, writer or section…")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search for a story, writer or section…"), { target: { value: "delta bridge" } });
    await settle(250);

    expect(fetchMock.mock.calls[0][0]).toContain("language=en");
    expect(screen.getByText("Delta bridge opens").closest("a")).toHaveAttribute("href", "/en/article/delta-bridge");
  });
});
