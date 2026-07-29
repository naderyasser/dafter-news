import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import VisitBeacon from "./VisitBeacon";

const sendBeacon = vi.fn().mockReturnValue(true);

describe("VisitBeacon", () => {
  beforeEach(() => {
    sessionStorage.clear();
    sendBeacon.mockClear().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", { value: sendBeacon, writable: true, configurable: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("renders nothing and counts the session once", () => {
    const { container } = render(<VisitBeacon />);

    expect(container).toBeEmptyDOMElement();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(String(sendBeacon.mock.calls[0][0])).toContain("/visits/track/");
  });

  it("does not count the same session twice — the visit semantics", () => {
    const { unmount } = render(<VisitBeacon />);
    unmount();
    // A navigation within the tab: new mount, same sessionStorage.
    render(<VisitBeacon />);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it("falls back to keepalive fetch when sendBeacon is refused", () => {
    sendBeacon.mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(<VisitBeacon />);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/visits/track/"),
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
  });

  it("never lets a failed count reach the reader", () => {
    sendBeacon.mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => render(<VisitBeacon />)).not.toThrow();
  });
});
