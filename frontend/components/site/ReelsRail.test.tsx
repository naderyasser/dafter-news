import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ReelsRail from "./ReelsRail";

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
  { id: 1, title: "لقطة من المؤتمر", thumbnail: "/media/reels/a.jpg", href: "/reel/lqta-mn-almwtmr", youtubeId: "AAAAAAAAAA1" },
  { id: 2, title: "الحصاد في دقيقة", thumbnail: null, href: "/reel/alhsad-fy-dqyqt", youtubeId: "AAAAAAAAAA2" },
];

describe("ReelsRail", () => {
  it("renders nothing at all when the shelf is empty", () => {
    const { container } = render(<ReelsRail lang="ar" reels={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the bold nameplate with its play mark", () => {
    render(<ReelsRail lang="ar" reels={reels} />);

    const heading = screen.getByRole("heading", { level: 2, name: "حصل إيه؟" });
    expect(heading.querySelector("svg")).not.toBeNull();
    // The one especially heavy heading weight on the site — see the
    // component's own docstring for why this is font-black and not the
    // usual font-extrabold every other section heading uses.
    expect(heading.className).toContain("font-black");
  });

  it("sits on the light band the client's reference showed, not the media desk's usual dark one", () => {
    const { container } = render(<ReelsRail lang="ar" reels={reels} />);

    const section = container.querySelector("section")!;
    expect(section.className).toContain("bg-paper");
    expect(section.className).not.toContain("bg-board");
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.className).toContain("text-ink");
  });

  it("gives every card the light tone to match, dark text over a paper body", () => {
    const { container } = render(<ReelsRail lang="ar" reels={reels} />);

    const card = screen.getByRole("link", { name: /لقطة من المؤتمر/ });
    expect(card.className).toContain("bg-paper");
    expect(card.className).toContain("border-line");
    const title = within(card).getByRole("heading", { level: 3 });
    expect(title.className).toContain("text-ink");
    // The image area itself is unaffected — a photo's own placeholder tone,
    // independent of which page it happens to sit on.
    expect(container.querySelector(".aspect-\\[9\\/16\\]")!.className).toContain("bg-board-stage");
  });

  it("puts the «المزيد» link under the title, pointed at the paper's YouTube channel", () => {
    render(<ReelsRail lang="ar" reels={reels} channelUrl="https://youtube.com/@aldaftar" />);

    const more = screen.getByRole("link", { name: /المزيد من الريلز/ });
    expect(more).toHaveAttribute("href", "https://youtube.com/@aldaftar");
    expect(more).toHaveAttribute("target", "_blank");
    expect(more.getAttribute("rel")).toContain("noopener");
    expect(more).toHaveTextContent("المزيد");
  });

  it("omits the «المزيد» link entirely when no channel is configured", () => {
    render(<ReelsRail lang="ar" reels={reels} />);

    // The only links left are the cards themselves, each pointed at its own
    // watch page rather than at YouTube.
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^\/reel\//);
    }
  });

  it("draws the accent bar as a two-tone split, not a single flat colour", () => {
    const { container } = render(<ReelsRail lang="ar" reels={reels} />);

    const bar = container.querySelector("#reels-heading > div:last-child")!;
    const segments = bar.children;
    expect(segments).toHaveLength(2);
    expect(segments[0].className).toContain("bg-brand");
    // `bg-line`, not the old on-dark white/15 — that neutral would be all
    // but invisible against the section's now-white background.
    expect(segments[1].className).toContain("bg-line");
    expect(segments[1].className).not.toContain("white/15");
  });

  it("keeps every card a real link to its own watch page — the no-script and crawler path", () => {
    render(<ReelsRail lang="ar" reels={reels} />);

    const card = screen.getByRole("link", { name: /لقطة من المؤتمر/ });
    expect(card).toHaveAttribute("href", "/reel/lqta-mn-almwtmr");
    // Nothing but the posters until a card is pressed: no button, no dialog.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("mounts no iframe until a reel is actually opened", () => {
    const { container } = render(<ReelsRail lang="ar" reels={reels} />);

    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
  });

  it("puts the title in the card's own body below the poster, not overlaid on it", () => {
    render(<ReelsRail lang="ar" reels={reels} />);

    const card = screen.getByRole("link", { name: /لقطة من المؤتمر/ });
    const poster = card.querySelector(".aspect-\\[9\\/16\\]")!;
    const heading = within(card).getByRole("heading", { level: 3, name: "لقطة من المؤتمر" });

    expect(poster.contains(heading)).toBe(false);
    expect(heading.className).toContain("line-clamp-2");
  });

  it("holds every poster to a 9:16 frame with its own overflow clip", () => {
    const { container } = render(<ReelsRail lang="ar" reels={reels} />);

    const frames = container.querySelectorAll(".aspect-\\[9\\/16\\]");
    expect(frames).toHaveLength(2);
    for (const frame of frames) expect(frame.className).toContain("overflow-hidden");
  });

  it("crops posters rather than stretching them", () => {
    const { container } = render(<ReelsRail lang="ar" reels={reels} />);

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.className).toContain("object-cover");
  });

  it("keeps a reel with no thumbnail in the rail rather than dropping it", () => {
    render(<ReelsRail lang="ar" reels={reels} />);

    expect(screen.getByRole("link", { name: /الحصاد في دقيقة/ })).toBeInTheDocument();
  });

  it("keeps the rail a real list, so the count is announced", () => {
    render(<ReelsRail lang="ar" reels={reels} />);

    const rail = screen.getByRole("list", { name: "ريلز يوتيوب" });
    expect(within(rail).getAllByRole("listitem")).toHaveLength(2);
  });

  it("speaks English on the English edition", () => {
    render(<ReelsRail lang="en" reels={reels} channelUrl="https://youtube.com/@aldaftar" />);

    expect(screen.getByRole("heading", { level: 2, name: "Catch Up" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /More reels/ })).toHaveTextContent("More");
    expect(screen.getByRole("link", { name: /لقطة من المؤتمر/ })).toHaveAccessibleName(/^Watch:/);
  });
});
