import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdsManager from "./AdsManager";
import type { AdPlacement } from "@/lib/types";

const dashMutate = vi.fn();
vi.mock("@/lib/api", () => ({ dashMutate: (...args: unknown[]) => dashMutate(...args) }));

const placements: AdPlacement[] = [
  { id: 1, name: "أعلى الرئيسية", size: "728×90", active: true, impressions: 1000, clicks: 20, ctr: 2 },
];

describe("AdsManager", () => {
  afterEach(() => dashMutate.mockReset());

  it("reverts the toggle and reports the failure instead of leaving a stale state", async () => {
    dashMutate.mockRejectedValue(new Error("network"));
    render(<AdsManager placements={placements} />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(screen.getByRole("alert")).toHaveTextContent("تعذّر تحديث حالة «أعلى الرئيسية»");
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });
});
