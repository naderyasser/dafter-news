import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReelsLightbox from "./ReelsLightbox";
import { REEL_COPY } from "./ReelPoster";

vi.mock("next/image", () => ({
  default: ({ src, alt, fill, priority, sizes, ...rest }: any) => (
    <img src={typeof src === "string" ? src : ""} alt={alt} {...rest} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const reels = [
  { id: 1, title: "لقطة من المؤتمر", thumbnail: "/media/reels/a.jpg", href: "/reel/lqta", youtubeId: "AAAAAAAAAA1" },
  { id: 2, title: "الحصاد في دقيقة", thumbnail: null, href: "/reel/alhsad", youtubeId: "AAAAAAAAAA2" },
  { id: 3, title: "من الشارع", thumbnail: null, href: "/reel/shari", youtubeId: "AAAAAAAAAA3" },
];

const t = REEL_COPY.ar;

const iframe = () => document.querySelector("iframe") as HTMLIFrameElement | null;
const embeddedId = () => new URL(iframe()!.src).pathname.replace("/embed/", "");

afterEach(() => {
  document.body.style.overflow = "";
});

describe("ReelsLightbox", () => {
  it("mounts nothing but the posters until a card is pressed — no iframe, no dialog", () => {
    render(<ReelsLightbox lang="ar" reels={reels} t={t} />);

    expect(iframe()).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("opens the pressed reel in the player instead of navigating", () => {
    render(<ReelsLightbox lang="ar" reels={reels} t={t} />);

    const card = screen.getByRole("link", { name: /الحصاد في دقيقة/ });
    const click = fireEvent.click(card);

    // The link is still there for crawlers and middle-clicks, but a plain
    // click is intercepted.
    expect(card).toHaveAttribute("href", "/reel/alhsad");
    expect(click).toBe(false);
    const dialog = screen.getByRole("dialog", { name: "مشغّل الريلز" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(embeddedId()).toBe("AAAAAAAAAA2");
    expect(new URL(iframe()!.src).searchParams.get("autoplay")).toBe("1");
    expect(within(dialog).getByRole("heading", { name: "الحصاد في دقيقة" })).toBeInTheDocument();
  });

  it("lets a modifier click fall through to the real link", () => {
    render(<ReelsLightbox lang="ar" reels={reels} t={t} />);

    const card = screen.getByRole("link", { name: /لقطة من المؤتمر/ });
    fireEvent.click(card, { ctrlKey: true });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("moves to the next and previous reel, swapping the one mounted player", () => {
    render(<ReelsLightbox lang="ar" reels={reels} t={t} />);
    fireEvent.click(screen.getByRole("link", { name: /لقطة من المؤتمر/ }));

    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    expect(embeddedId()).toBe("AAAAAAAAAA2");
    expect(document.querySelectorAll("iframe")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "السابق" }));
    expect(embeddedId()).toBe("AAAAAAAAAA1");
  });

  it("disables the arrow at either end rather than wrapping around", () => {
    render(<ReelsLightbox lang="ar" reels={reels} t={t} />);
    fireEvent.click(screen.getByRole("link", { name: /لقطة من المؤتمر/ }));

    expect(screen.getByRole("button", { name: "السابق" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "التالي" })).toBeEnabled();

    fireEvent.click(screen.getByRole("link", { name: /الحصاد/ }));
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    expect(screen.getByRole("button", { name: "التالي" })).toBeDisabled();
  });

  it("follows reading direction on the arrow keys and closes on Escape", () => {
    render(<ReelsLightbox lang="ar" reels={reels} t={t} />);
    fireEvent.click(screen.getByRole("link", { name: /لقطة من المؤتمر/ }));

    // In Arabic, forward is to the LEFT.
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(embeddedId()).toBe("AAAAAAAAAA2");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(embeddedId()).toBe("AAAAAAAAAA1");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(iframe()).toBeNull();
  });

  it("closes on the close button and on the backdrop, but not on the player column", () => {
    render(<ReelsLightbox lang="ar" reels={reels} t={t} />);
    fireEvent.click(screen.getByRole("link", { name: /لقطة من المؤتمر/ }));

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("heading", { level: 2 }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "إغلاق" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: /لقطة من المؤتمر/ }));
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("locks the page scroll while open and restores it on close", () => {
    render(<ReelsLightbox lang="ar" reels={reels} t={t} />);
    fireEvent.click(screen.getByRole("link", { name: /لقطة من المؤتمر/ }));

    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.body.style.overflow).toBe("");
  });

  it("links out to the reel's own page and to YouTube, and counts the position", () => {
    render(<ReelsLightbox lang="ar" reels={reels} t={t} />);
    fireEvent.click(screen.getByRole("link", { name: /الحصاد في دقيقة/ }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("link", { name: "صفحة الريل" })).toHaveAttribute("href", "/reel/alhsad");
    const yt = within(dialog).getByRole("link", { name: /شاهد على يوتيوب/ });
    expect(yt).toHaveAttribute("href", "https://www.youtube.com/watch?v=AAAAAAAAAA2");
    expect(yt).toHaveAttribute("target", "_blank");
    expect(dialog.textContent).toContain("2 / 3");
  });

  it("advances on a decisive horizontal swipe", () => {
    render(<ReelsLightbox lang="ar" reels={reels} t={t} />);
    fireEvent.click(screen.getByRole("link", { name: /لقطة من المؤتمر/ }));
    const column = within(screen.getByRole("dialog")).getByRole("heading", { level: 2 }).parentElement!;

    // RTL: the next reel sits to the LEFT, so dragging the content towards
    // the right edge is what reveals it (see lib/useSwipe).
    act(() => {
      fireEvent.touchStart(column, { touches: [{ clientX: 100, clientY: 100 }] });
      fireEvent.touchEnd(column, { changedTouches: [{ clientX: 300, clientY: 110 }] });
    });

    expect(embeddedId()).toBe("AAAAAAAAAA2");
  });
});
