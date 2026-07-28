import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import FeedsPanel from "./FeedsPanel";
import type { SyncLog } from "@/lib/types";

const dashMutate = vi.fn();
vi.mock("@/lib/api", () => ({ dashMutate: (...args: unknown[]) => dashMutate(...args) }));

const log = (id: number, source: string): SyncLog => ({
  id,
  source,
  label: source,
  status: "ok",
  message: "",
  last_success_at: "2026-01-01T00:00:00Z",
  is_stale: false,
  records: 10,
} as SyncLog);

describe("FeedsPanel refresh", () => {
  afterEach(() => {
    dashMutate.mockReset();
    vi.unstubAllGlobals();
  });

  it("goes through dashMutate (session cookie + CSRF token) instead of a bare unauthenticated fetch", async () => {
    // A bare fetch() would carry no X-CSRFToken header and always 403 against
    // SessionAuthentication's CSRF enforcement on POST — dashMutate is the
    // only call in the dashboard that attaches it.
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    dashMutate.mockResolvedValue([log(1, "wire")]);

    render(<FeedsPanel logs={[]} />);
    await act(async () => {
      fireEvent.click(screen.getByText("تحديث الكل"));
    });

    expect(dashMutate).toHaveBeenCalledWith("/sync-now/", "POST", {});
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByText("wire")).toBeInTheDocument();
  });

  it("sends the per-source refresh with its source key", async () => {
    dashMutate.mockResolvedValue([log(1, "wire")]);
    render(<FeedsPanel logs={[log(1, "wire")]} />);

    await act(async () => {
      fireEvent.click(screen.getByText("تحديث"));
    });

    expect(dashMutate).toHaveBeenCalledWith("/sync-now/", "POST", { source: "wire" });
  });

  it("shows the error banner when the refresh fails", async () => {
    dashMutate.mockRejectedValue(new Error("403"));
    render(<FeedsPanel logs={[]} />);

    await act(async () => {
      fireEvent.click(screen.getByText("تحديث الكل"));
    });

    expect(screen.getByText("تعذّر تشغيل التحديث — راجع سجلّ الخادم")).toBeInTheDocument();
  });
});
