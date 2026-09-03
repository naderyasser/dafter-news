import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReelPlayer from "./ReelPlayer";

const facebookUrl = "https://www.facebook.com/reel/123";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ReelPlayer", () => {
  it("embeds Facebook's own video plugin, pointed at this reel", () => {
    render(<ReelPlayer lang="ar" title="عنوان الريل" facebookUrl={facebookUrl} />);

    const iframe = screen.getByTitle("عنوان الريل") as HTMLIFrameElement;
    const src = new URL(iframe.src);
    expect(src.origin + src.pathname).toBe("https://www.facebook.com/plugins/video.php");
    expect(src.searchParams.get("href")).toBe(facebookUrl);
    expect(src.searchParams.get("autoplay")).toBe("true");
  });

  it("grants the permissions Facebook's own Share control needs", () => {
    render(<ReelPlayer lang="ar" title="عنوان" facebookUrl={facebookUrl} />);

    const iframe = screen.getByTitle("عنوان");
    expect(iframe.getAttribute("allow")).toContain("clipboard-write");
    expect(iframe.getAttribute("allow")).toContain("web-share");
    expect(iframe).toHaveAttribute("allowfullscreen");
  });

  /**
   * The newsroom's mobile report: the player filled the whole screen and the
   * share / «تفاعل على فيسبوك» buttons landed under the fold. Sized by width
   * («w-full max-w-md» + «aspect-[9/16]»), a vertical video on a 360×640 phone
   * renders 360 wide and so 640 tall — the exact height of the viewport. The
   * frame is sized from the viewport's HEIGHT now instead; see .reel-stage in
   * globals.css for the whole reasoning.
   */
  describe("mobile layout", () => {
    it("sizes the frame from the viewport height, not the full column width", () => {
      render(<ReelPlayer lang="ar" title="عنوان" facebookUrl={facebookUrl} />);

      const stage = screen.getByTitle("عنوان").parentElement!;
      expect(stage.className).toContain("reel-stage");
      // The width-driven pair that put the action row under the fold.
      expect(stage.className).not.toContain("w-full");
      expect(stage.className).not.toContain("aspect-[9/16]");
    });

    it("takes the iframe out of flow so no baseline sliver overflows the frame", () => {
      // An <iframe> is inline by default: the line-height under it overflows
      // an aspect-ratio'd parent as a strip of the frame's own background.
      render(<ReelPlayer lang="ar" title="عنوان" facebookUrl={facebookUrl} />);

      const iframe = screen.getByTitle("عنوان");
      expect(iframe.className).toContain("absolute");
      expect(iframe.className).toContain("inset-0");
      expect(iframe.className).toContain("h-full");
      expect(iframe.className).toContain("w-full");
    });

    it("keeps the frame and both actions in one capped, centred column", () => {
      render(<ReelPlayer lang="ar" title="عنوان" facebookUrl={facebookUrl} />);

      const column = screen.getByTitle("عنوان").parentElement!.parentElement!;
      expect(column.className).toContain("flex");
      expect(column.className).toContain("flex-col");
      expect(column.className).toContain("items-center");
      expect(column.className).toMatch(/max-w-\[\d+px\]/);
      // Both actions live in that same column, so nothing is laid out
      // against a width the frame above it no longer has.
      expect(column).toContainElement(screen.getByRole("button", { name: /مشاركة/ }));
      expect(column).toContainElement(screen.getByRole("link", { name: /تفاعل على فيسبوك/ }));
      expect(column).toContainElement(screen.getByRole("link", { name: /فتح على فيسبوك/ }));
    });
  });

  it("tells the reader where to turn sound on, as two centred lines", () => {
    render(<ReelPlayer lang="ar" title="عنوان" facebookUrl={facebookUrl} />);

    expect(screen.getByText("اضغط على أيقونة الصوت")).toBeInTheDocument();
    expect(screen.getByText("لسماع صوت الفيديو")).toBeInTheDocument();
  });

  it("sits as a compact box in the player's own top corner, not a bar along its edge", () => {
    render(<ReelPlayer lang="ar" title="عنوان" facebookUrl={facebookUrl} />);

    const badge = screen.getByRole("button", { name: "إخفاء هذا التنبيه" });
    expect(badge.className).toContain("top-6");
    expect(badge.className).toContain("end-6");
    // A box, not a bar: bounded to a fixed width rather than stretching
    // edge to edge the way the earlier bottom-bar version did.
    expect(badge.className).toMatch(/w-\[\d+px\]/);
  });

  it("lets the reader dismiss the muted-sound hint by pressing the badge itself", async () => {
    render(<ReelPlayer lang="ar" title="عنوان" facebookUrl={facebookUrl} />);
    const badge = screen.getByRole("button", { name: "إخفاء هذا التنبيه" });

    await act(async () => badge.click());

    // Faded, not removed — see the next test for why it has to stay mounted
    // for the opacity transition to actually animate.
    expect(badge.className).toContain("opacity-0");
    expect(badge.className).toContain("pointer-events-none");
    // Dismissing the hint must not touch the player itself.
    expect(screen.getByTitle("عنوان")).toBeInTheDocument();
  });

  it("stays mounted through dismissal so the fade can actually transition, and drops out of the a11y tree once faded", async () => {
    render(<ReelPlayer lang="ar" title="عنوان" facebookUrl={facebookUrl} />);
    const badge = screen.getByRole("button", { name: "إخفاء هذا التنبيه" });

    await act(async () => badge.click());

    // Still the same node in the DOM (a conditionally-unmounted element
    // couldn't animate its own removal without extra machinery this project
    // doesn't use anywhere) — but pulled out of the accessibility tree and
    // the Tab order, so a screen reader or keyboard user doesn't land on an
    // invisible button.
    expect(screen.getByTitle("عنوان").parentElement?.contains(badge)).toBe(true);
    expect(badge).toHaveAttribute("aria-hidden", "true");
    expect(badge).toHaveAttribute("tabindex", "-1");
  });

  it("auto-dismisses the muted-sound hint on its own after five seconds", async () => {
    vi.useFakeTimers();

    render(<ReelPlayer lang="ar" title="عنوان" facebookUrl={facebookUrl} />);
    const badge = screen.getByRole("button", { name: "إخفاء هذا التنبيه" });
    expect(badge.className).toContain("opacity-100");

    await act(async () => vi.advanceTimersByTime(4999));
    expect(badge.className).toContain("opacity-100");

    await act(async () => vi.advanceTimersByTime(1));
    expect(badge.className).toContain("opacity-0");
  });

  it("cancels the auto-dismiss timer on unmount rather than leaking it", async () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(global, "clearTimeout");

    const { unmount } = render(<ReelPlayer lang="ar" title="عنوان" facebookUrl={facebookUrl} />);
    unmount();

    expect(clearSpy).toHaveBeenCalled();
    // Advancing time after unmount must not throw — there is no component
    // left for a leaked timer to call setState on.
    await expect(act(async () => vi.advanceTimersByTime(5000))).resolves.not.toThrow();
  });

  it("uses the native share sheet when the browser offers one, sharing the real Facebook link", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share });

    render(<ReelPlayer lang="ar" title="عنوان الريل" facebookUrl={facebookUrl} />);
    await act(async () => screen.getByRole("button", { name: /مشاركة/ }).click());

    expect(share).toHaveBeenCalledWith({ title: "عنوان الريل", url: facebookUrl });
  });

  it("swallows a cancelled or refused native share rather than erroring", async () => {
    const share = vi.fn().mockRejectedValue(new Error("cancelled"));
    vi.stubGlobal("navigator", { ...navigator, share });

    render(<ReelPlayer lang="ar" title="عنوان" facebookUrl={facebookUrl} />);

    // No unhandled rejection / thrown error reaching the test.
    await expect(act(async () => screen.getByRole("button", { name: /مشاركة/ }).click())).resolves.not.toThrow();
  });

  it("falls back to copying the link when there is no native share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });

    render(<ReelPlayer lang="ar" title="عنوان" facebookUrl={facebookUrl} />);
    await act(async () => screen.getByRole("button", { name: "مشاركة" }).click());

    expect(writeText).toHaveBeenCalledWith(facebookUrl);
    expect(screen.getByRole("button", { name: "تم نسخ الرابط" })).toBeInTheDocument();
  });

  it("reverts the copied confirmation after a short delay", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });

    render(<ReelPlayer lang="ar" title="عنوان" facebookUrl={facebookUrl} />);
    await act(async () => screen.getByRole("button", { name: "مشاركة" }).click());
    expect(screen.getByRole("button", { name: "تم نسخ الرابط" })).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTime(2000));

    expect(screen.getByRole("button", { name: "مشاركة" })).toBeInTheDocument();
  });

  it("links the honest engage-on-Facebook action to the real reel, in a new tab", () => {
    render(<ReelPlayer lang="ar" title="عنوان" facebookUrl={facebookUrl} />);

    const engage = screen.getByRole("link", { name: /تفاعل على فيسبوك/ });
    expect(engage).toHaveAttribute("href", facebookUrl);
    expect(engage).toHaveAttribute("target", "_blank");
    expect(engage.getAttribute("rel")).toContain("noopener");
  });

  it("keeps a second, plainer fallback link back to Facebook, separate from the action row", () => {
    render(<ReelPlayer lang="ar" title="عنوان" facebookUrl={facebookUrl} />);

    const fallback = screen.getByRole("link", { name: /فتح على فيسبوك/ });
    expect(fallback).toHaveAttribute("href", facebookUrl);
    expect(fallback).toHaveAttribute("target", "_blank");
  });

  it("shows no fabricated Like or reaction count anywhere", () => {
    // The whole point: no Graph API access, so no real number exists to
    // show — and a plausible-looking fake one would be a lie, not a UI gap.
    const { container } = render(<ReelPlayer lang="ar" title="عنوان" facebookUrl={facebookUrl} />);

    expect(container.textContent).not.toMatch(/\d[\d,.]*\s*(K|k|ألف|إعجاب|تفاعل)/);
  });

  it("speaks English on the English edition", () => {
    render(<ReelPlayer lang="en" title="Reel title" facebookUrl={facebookUrl} />);

    expect(screen.getByText("Tap the sound icon")).toBeInTheDocument();
    expect(screen.getByText("to hear the video")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Engage on Facebook/ })).toBeInTheDocument();
  });
});
