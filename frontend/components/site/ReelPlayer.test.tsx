import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReelPlayer from "./ReelPlayer";

const props = {
  title: "عنوان الريل",
  youtubeId: "eF44mfjFjW8",
  shareUrl: "https://aldaftarnews.com/reel/عنوان-الريل",
  watchUrl: "https://www.youtube.com/shorts/eF44mfjFjW8",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ReelPlayer", () => {
  it("embeds YouTube's privacy-enhanced player for this reel, autoplaying", () => {
    render(<ReelPlayer lang="ar" {...props} />);

    const iframe = screen.getByTitle("عنوان الريل") as HTMLIFrameElement;
    const src = new URL(iframe.src);
    expect(src.origin + src.pathname).toBe("https://www.youtube-nocookie.com/embed/eF44mfjFjW8");
    expect(src.searchParams.get("autoplay")).toBe("1");
    expect(src.searchParams.get("playsinline")).toBe("1");
  });

  it("grants the permissions YouTube's own embed code asks for", () => {
    render(<ReelPlayer lang="ar" {...props} />);

    const iframe = screen.getByTitle("عنوان الريل");
    expect(iframe.getAttribute("allow")).toContain("autoplay");
    expect(iframe.getAttribute("allow")).toContain("clipboard-write");
    expect(iframe.getAttribute("allow")).toContain("web-share");
    expect(iframe).toHaveAttribute("allowfullscreen");
  });

  /**
   * Sized by width («w-full max-w-md» + «aspect-[9/16]»), a vertical video on
   * a 360×640 phone renders 360 wide and so 640 tall — the exact height of
   * the viewport, with the actions under the fold. The frame is sized from
   * the viewport's HEIGHT instead; see .reel-stage in globals.css.
   */
  describe("mobile layout", () => {
    it("sizes the frame from the viewport height, not the full column width", () => {
      render(<ReelPlayer lang="ar" {...props} />);

      const stage = screen.getByTitle("عنوان الريل").parentElement!;
      expect(stage.className).toContain("reel-stage");
      expect(stage.className).not.toContain("w-full");
      expect(stage.className).not.toContain("aspect-[9/16]");
    });

    it("takes the iframe out of flow so no baseline sliver overflows the frame", () => {
      render(<ReelPlayer lang="ar" {...props} />);

      const iframe = screen.getByTitle("عنوان الريل");
      expect(iframe.className).toContain("absolute");
      expect(iframe.className).toContain("inset-0");
      expect(iframe.className).toContain("h-full");
      expect(iframe.className).toContain("w-full");
    });

    it("keeps the frame and both actions in one capped, centred column", () => {
      render(<ReelPlayer lang="ar" {...props} />);

      const column = screen.getByTitle("عنوان الريل").parentElement!.parentElement!;
      expect(column.className).toContain("flex-col");
      expect(column.className).toContain("items-center");
      expect(column.className).toMatch(/max-w-\[\d+px\]/);
      expect(column).toContainElement(screen.getByRole("button", { name: /مشاركة/ }));
      expect(column).toContainElement(screen.getByRole("link", { name: /شاهد على يوتيوب/ }));
    });
  });

  it("uses the native share sheet when the browser offers one, sharing this page's own URL", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share });

    render(<ReelPlayer lang="ar" {...props} />);
    await act(async () => screen.getByRole("button", { name: /مشاركة/ }).click());

    expect(share).toHaveBeenCalledWith({ title: "عنوان الريل", url: props.shareUrl });
  });

  it("swallows a cancelled or refused native share rather than erroring", async () => {
    const share = vi.fn().mockRejectedValue(new Error("cancelled"));
    vi.stubGlobal("navigator", { ...navigator, share });

    render(<ReelPlayer lang="ar" {...props} />);

    await expect(act(async () => screen.getByRole("button", { name: /مشاركة/ }).click())).resolves.not.toThrow();
  });

  it("falls back to copying the link when there is no native share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });

    render(<ReelPlayer lang="ar" {...props} />);
    await act(async () => screen.getByRole("button", { name: "مشاركة" }).click());

    expect(writeText).toHaveBeenCalledWith(props.shareUrl);
    expect(screen.getByRole("button", { name: "تم نسخ الرابط" })).toBeInTheDocument();
  });

  it("reverts the copied confirmation after a short delay", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });

    render(<ReelPlayer lang="ar" {...props} />);
    await act(async () => screen.getByRole("button", { name: "مشاركة" }).click());
    await act(async () => vi.advanceTimersByTime(2000));

    expect(screen.getByRole("button", { name: "مشاركة" })).toBeInTheDocument();
  });

  it("links to the video on YouTube itself, in a new tab", () => {
    render(<ReelPlayer lang="ar" {...props} />);

    const link = screen.getByRole("link", { name: /شاهد على يوتيوب/ });
    expect(link).toHaveAttribute("href", props.watchUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("shows no fabricated Like or view count anywhere", () => {
    const { container } = render(<ReelPlayer lang="ar" {...props} />);

    expect(container.textContent).not.toMatch(/\d[\d,.]*\s*(K|k|ألف|إعجاب|مشاهدة)/);
  });

  it("speaks English on the English edition", () => {
    render(<ReelPlayer lang="en" {...props} title="Reel title" />);

    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Watch on YouTube/ })).toBeInTheDocument();
  });
});
