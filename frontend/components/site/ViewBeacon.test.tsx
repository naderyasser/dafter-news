import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ViewBeacon from "./ViewBeacon";
import { API_URL } from "@/lib/api";

describe("ViewBeacon", () => {
  let sent: string[];

  beforeEach(() => {
    sent = [];
    sessionStorage.clear();
    vi.stubGlobal("navigator", {
      sendBeacon: (url: string) => {
        sent.push(url);
        return true;
      },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("counts the read against this article", () => {
    render(<ViewBeacon slug="central-bank-holds" />);

    expect(sent).toEqual([`${API_URL}/articles/central-bank-holds/track-view/`]);
  });

  it("percent-encodes an Arabic slug", () => {
    render(<ViewBeacon slug="الرئيس-يفتتح-المحور" />);

    expect(sent[0]).toBe(`${API_URL}/articles/${encodeURIComponent("الرئيس-يفتتح-المحور")}/track-view/`);
  });

  it("counts a story once however hard it is refreshed", () => {
    // A chart that can be climbed by holding F5 is worth less than no chart.
    render(<ViewBeacon slug="a" />);
    render(<ViewBeacon slug="a" />);
    render(<ViewBeacon slug="a" />);

    expect(sent).toHaveLength(1);
  });

  it("counts a genuine return to the same story half an hour later", () => {
    // Without this the counter is invisible to the newsroom testing it: one
    // tab could only ever contribute a single read per article, forever.
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    render(<ViewBeacon slug="a" />);
    expect(sent).toHaveLength(1);

    vi.spyOn(Date, "now").mockReturnValue(now + 31 * 60 * 1000);
    render(<ViewBeacon slug="a" />);

    expect(sent).toHaveLength(2);
    vi.restoreAllMocks();
  });

  it("does not re-count a story revisited a few minutes later", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    render(<ViewBeacon slug="a" />);

    vi.spyOn(Date, "now").mockReturnValue(now + 5 * 60 * 1000);
    render(<ViewBeacon slug="a" />);

    expect(sent).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it("counts the read when the stored stamp is corrupted", () => {
    sessionStorage.setItem("aldaftar:read:a", "not-a-number");

    render(<ViewBeacon slug="a" />);

    expect(sent).toHaveLength(1);
  });

  it("counts each article a reader opens", () => {
    render(<ViewBeacon slug="a" />);
    render(<ViewBeacon slug="b" />);

    expect(sent).toHaveLength(2);
  });

  it("still counts when sessionStorage is unavailable", () => {
    // Private mode with storage blocked must not silently stop counting.
    const boom = () => {
      throw new Error("blocked");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom);

    render(<ViewBeacon slug="a" />);

    expect(sent).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it("falls back to keepalive fetch where sendBeacon is missing", () => {
    const fetchMock = vi.fn(() => Promise.resolve({} as Response));
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", fetchMock);

    render(<ViewBeacon slug="a" />);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/articles/a/track-view/`,
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
  });

  it("never lets a failed beacon reach the reader", () => {
    vi.stubGlobal("navigator", {
      sendBeacon: () => {
        throw new Error("offline");
      },
    });

    expect(() => render(<ViewBeacon slug="a" />)).not.toThrow();
  });

  it("renders nothing", () => {
    const { container } = render(<ViewBeacon slug="a" />);

    expect(container).toBeEmptyDOMElement();
  });
});
