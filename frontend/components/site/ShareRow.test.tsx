import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ShareRow from "./ShareRow";

describe("ShareRow", () => {
  let openSpy: ReturnType<typeof vi.spyOn>;
  const writeText = vi.fn();

  beforeEach(() => {
    openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    Object.assign(navigator, { clipboard: { writeText } });
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

  it("copies the current URL instead of opening a window", () => {
    render(<ShareRow lang="ar" title="خبر" />);

    fireEvent.click(screen.getByTitle("نسخ الرابط"));

    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("speaks English labels on the English edition", () => {
    render(<ShareRow lang="en" title="Title" />);

    expect(screen.getByTitle("Facebook")).toBeInTheDocument();
    expect(screen.getByTitle("Copy link")).toBeInTheDocument();
  });
});
