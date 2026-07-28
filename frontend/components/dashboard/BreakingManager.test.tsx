import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BreakingManager from "./BreakingManager";
import type { BreakingNewsItem } from "@/lib/types";

const dashMutate = vi.fn();
vi.mock("@/lib/api", () => ({ API_URL: "http://localhost:8000/api", dashMutate: (...args: unknown[]) => dashMutate(...args) }));

const item = (id: number, text: string, order: number): BreakingNewsItem => ({
  id,
  text,
  href: "",
  order,
  active: true,
  expires_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
});

describe("BreakingManager move", () => {
  beforeEach(() => {
    // The push-status effect fires a bare fetch on mount; keep it off the
    // network and let its own .catch(() => setPush(null)) handle it.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    dashMutate.mockReset();
  });

  it("renumbers every row instead of PATCHing only the two swapped rows' raw indices", async () => {
    // All three were created with order:0, so on screen they read C, B, A —
    // the newest first, tied on order and broken by -created_at server-side.
    const items = [item(3, "C", 0), item(2, "B", 0), item(1, "A", 0)];
    dashMutate.mockResolvedValue({});
    render(<BreakingManager items={items} />);

    await act(async () => {
      // Move "B" (the middle row) up one slot.
      fireEvent.click(screen.getAllByText("▲")[1]);
    });

    // The old bug only ever PATCHed the two swapped rows (with their raw
    // array indices as the new order) and left the third row's order
    // untouched — a real, live-visible ordering bug once that stale value
    // sorted ahead of or behind rows it was never meant to.
    expect(dashMutate).toHaveBeenCalledTimes(3);
    expect(dashMutate).toHaveBeenCalledWith("/breaking/2/", "PATCH", { order: 1 });
    expect(dashMutate).toHaveBeenCalledWith("/breaking/3/", "PATCH", { order: 2 });
    expect(dashMutate).toHaveBeenCalledWith("/breaking/1/", "PATCH", { order: 3 });

    // And the on-screen order reflects the swap: B, C, A.
    const rows = screen.getAllByText(/^[ABC]$/);
    expect(rows.map((r) => r.textContent)).toEqual(["B", "C", "A"]);
  });

  it("reverts the list and reports the failure when a PATCH is rejected", async () => {
    const items = [item(3, "C", 0), item(2, "B", 0), item(1, "A", 0)];
    dashMutate.mockRejectedValue(new Error("network"));
    render(<BreakingManager items={items} />);

    await act(async () => {
      fireEvent.click(screen.getAllByText("▲")[1]);
    });

    const rows = screen.getAllByText(/^[ABC]$/);
    expect(rows.map((r) => r.textContent)).toEqual(["C", "B", "A"]);
    expect(screen.getByRole("alert")).toHaveTextContent("تعذّر إعادة الترتيب");
  });
});
