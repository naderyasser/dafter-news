import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SearchBox from "./SearchBox";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

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
