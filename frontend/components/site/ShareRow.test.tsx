import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ShareRow from "./ShareRow";

describe("ShareRow", () => {
  let openSpy: ReturnType<typeof vi.spyOn>;
  const writeText = vi.fn();

  beforeEach(() => {
    openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    Object.assign(navigator, { clipboard: { writeText } });
    // Not implemented in jsdom; individual tests opt in where they need it.
    Object.assign(navigator, { share: undefined });
    window.history.pushState({}, "", "/article/test-slug");
  });

  afterEach(() => {
    openSpy.mockRestore();
    writeText.mockClear();
  });

  it("orders the platforms فيسبوك ← X ← ثريدز ← واتساب ← نسخ الرابط", () => {
    render(<ShareRow lang="ar" title="عنوان الخبر" />);

    const buttons = screen.getAllByTitle(/فيسبوك|منصة X|ثريدز|واتساب|نسخ الرابط/);
    expect(buttons.map((b) => b.title)).toEqual(["فيسبوك", "منصة X", "ثريدز", "واتساب", "نسخ الرابط"]);
  });

  it("renders real buttons, so the row is reachable by keyboard", () => {
    // regression: these were <span onClick>, which no keyboard user could
    // reach and no assistive tech announced as actionable.
    render(<ShareRow lang="ar" title="عنوان الخبر" />);

    expect(screen.getByRole("button", { name: "فيسبوك" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "نسخ الرابط" })).toBeInTheDocument();
  });

  it("opens the Facebook sharer with the current page's URL", () => {
    render(<ShareRow lang="ar" title="عنوان الخبر" />);

    fireEvent.click(screen.getByTitle("فيسبوك"));

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("facebook.com/sharer/sharer.php?u="),
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("opens X's intent with both the URL and the title", () => {
    render(<ShareRow lang="ar" title="زلزال يضرب المنطقة" />);

    fireEvent.click(screen.getByTitle("منصة X"));

    const calledUrl = openSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("x.com/intent/tweet");
    expect(calledUrl).toContain(encodeURIComponent("زلزال يضرب المنطقة"));
  });

  it("opens Threads' post intent with the title and URL folded into one text param", () => {
    render(<ShareRow lang="ar" title="خبر" />);

    fireEvent.click(screen.getByTitle("ثريدز"));

    expect(openSpy.mock.calls[0][0]).toContain("threads.net/intent/post?text=");
  });

  it("opens WhatsApp's share link with no fixed phone number — the reader picks who to send it to", () => {
    render(<ShareRow lang="ar" title="خبر" />);

    fireEvent.click(screen.getByTitle("واتساب"));

    expect(openSpy.mock.calls[0][0]).toContain("wa.me/?text=");
  });

  it("copies the current URL instead of opening a window", async () => {
    writeText.mockResolvedValue(undefined);
    render(<ShareRow lang="ar" title="خبر" />);

    await act(async () => fireEvent.click(screen.getByTitle("نسخ الرابط")));

    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("confirms a successful copy, so the button never looks dead", async () => {
    // regression: a successful copy gave no feedback at all, which is
    // indistinguishable from a broken button.
    writeText.mockResolvedValue(undefined);
    render(<ShareRow lang="ar" title="خبر" />);

    await act(async () => fireEvent.click(screen.getByTitle("نسخ الرابط")));

    expect(await screen.findByRole("status")).toHaveTextContent("تم نسخ الرابط");
  });

  it("falls back to execCommand when the clipboard API is unavailable (plain http origins)", async () => {
    // regression: navigator.clipboard is undefined outside a secure
    // context, so the old optional-chained call silently did nothing —
    // the actual "share button doesn't work" report.
    Object.assign(navigator, { clipboard: undefined });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.assign(document, { execCommand });
    render(<ShareRow lang="ar" title="خبر" />);

    await act(async () => fireEvent.click(screen.getByTitle("نسخ الرابط")));

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(await screen.findByRole("status")).toHaveTextContent("تم نسخ الرابط");
  });

  it("reports a genuine copy failure rather than pretending it worked", async () => {
    Object.assign(navigator, { clipboard: undefined });
    Object.assign(document, { execCommand: vi.fn().mockReturnValue(false) });
    render(<ShareRow lang="ar" title="خبر" />);

    await act(async () => fireEvent.click(screen.getByTitle("نسخ الرابط")));

    expect(await screen.findByRole("status")).toHaveTextContent("تعذّر النسخ");
  });

  it("prefers the native share sheet when the device offers one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });
    render(<ShareRow lang="ar" title="خبر" />);

    await act(async () => fireEvent.click(screen.getByTitle("نسخ الرابط")));

    expect(share).toHaveBeenCalledWith({ title: "خبر", url: window.location.href });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("treats a dismissed share sheet as a cancel, not a failure to fall back from", async () => {
    const abort = Object.assign(new Error("cancelled"), { name: "AbortError" });
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(abort) });
    render(<ShareRow lang="ar" title="خبر" />);

    await act(async () => fireEvent.click(screen.getByTitle("نسخ الرابط")));

    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("speaks English labels on the English edition", () => {
    render(<ShareRow lang="en" title="Title" />);

    expect(screen.getByTitle("Facebook")).toBeInTheDocument();
    expect(screen.getByTitle("Copy link")).toBeInTheDocument();
  });
});
