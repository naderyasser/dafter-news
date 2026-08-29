import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HeroCarouselBlock from "./HeroCarouselBlock";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, ...rest }: any) => <img src={typeof src === "string" ? src : ""} alt={alt} {...rest} />,
}));

const cards = Array.from({ length: 5 }, (_, i) => ({
  href: `/article/p${i}`,
  title: `عنوان ${i}`,
  time: "منذ ساعة",
  imageSrc: `/media/p${i}.jpg`,
}));

/**
 * The client's own reference screenshot for «سياسة»: a full-width lead card
 * with the headline set on the photo, then the rest as a two-up, paged
 * carousel with side arrows and a dot row — not the plain card grid every
 * other still-default section uses. These lock that shape in place.
 */
describe("HeroCarouselBlock", () => {
  it("renders nothing rather than a bare heading when the feed is empty", () => {
    const { container } = render(<HeroCarouselBlock lang="ar" title="سياسة" href="/section/pol" cards={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("gives the first card the full-width lead treatment", () => {
    render(<HeroCarouselBlock lang="ar" title="سياسة" href="/section/pol" cards={cards} />);

    const lead = screen.getByRole("link", { name: /عنوان 0/ });
    expect(lead).toBeInTheDocument();
    // The lead's headline sits in the plain flow under its photo, in ink —
    // same shape as a tile's, just a bigger size class.
    expect(lead.querySelector("h3")).toHaveClass("text-ink");
  });

  it("shows exactly two tiles per page from the remaining cards", () => {
    render(<HeroCarouselBlock lang="ar" title="سياسة" href="/section/pol" cards={cards} />);

    expect(screen.getByRole("link", { name: /عنوان 1/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /عنوان 2/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /عنوان 3/ })).not.toBeInTheDocument();
  });

  it("falls back the corner tag to the section name when the article has no subcategory", () => {
    render(
      <HeroCarouselBlock
        lang="ar"
        title="سياسة"
        href="/section/pol"
        cards={[{ ...cards[0] }, { ...cards[1], chip: undefined }, { ...cards[2], chip: "حرب إيران" }]}
      />,
    );

    // The tile with an explicit chip shows it...
    expect(screen.getByText("حرب إيران")).toBeInTheDocument();
    // ...the one without simply shows nothing there, rather than a blank pill.
    const secondTile = screen.getByRole("link", { name: /عنوان 1/ });
    expect(secondTile.querySelector(".bg-badge-breaking")).toBeNull();
  });

  it("colours a plain topic chip the same red as a real badge — regression: the client's own reference showed both flat red", () => {
    render(
      <HeroCarouselBlock
        lang="ar"
        title="سياسة"
        href="/section/pol"
        cards={[{ ...cards[0] }, { ...cards[1], chip: "حرب إيران" }, { ...cards[2], badge: "breaking" }]}
      />,
    );

    const topicChip = screen.getByText("حرب إيران");
    expect(topicChip).toHaveClass("bg-badge-breaking");

    const urgentTile = screen.getByRole("link", { name: /عنوان 2/ });
    expect(urgentTile.querySelector(".bg-badge-breaking")).not.toBeNull();
  });

  it("shows a timestamp under a carousel tile — regression: only the lead card had one", () => {
    render(<HeroCarouselBlock lang="ar" title="سياسة" href="/section/pol" cards={cards} />);

    const tile = screen.getByRole("link", { name: /عنوان 1/ });
    expect(tile).toHaveTextContent("منذ ساعة");
  });

  it("advances a full page (two cards) per arrow click, and disables at each end", () => {
    render(<HeroCarouselBlock lang="ar" title="سياسة" href="/section/pol" cards={cards} />);

    const next = screen.getByRole("button", { name: "التالي" });
    const prev = screen.getByRole("button", { name: "السابق" });
    expect(prev).toBeDisabled();

    fireEvent.click(next);
    expect(screen.getByRole("link", { name: /عنوان 3/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /عنوان 4/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /عنوان 1/ })).not.toBeInTheDocument();

    fireEvent.click(next);
    expect(next).toBeDisabled();
  });

  it("jumps directly to a page via its dot", () => {
    render(<HeroCarouselBlock lang="ar" title="سياسة" href="/section/pol" cards={cards} />);

    const dots = screen.getAllByRole("tab");
    // 4 remaining cards after the lead, 2 per page = 2 pages.
    expect(dots).toHaveLength(2);

    fireEvent.click(dots[1]);

    expect(screen.getByRole("link", { name: /عنوان 3/ })).toBeInTheDocument();
    expect(dots[1]).toHaveAttribute("aria-selected", "true");
  });

  it("skips the arrows and dots entirely when everything fits on one page", () => {
    render(<HeroCarouselBlock lang="ar" title="سياسة" href="/section/pol" cards={cards.slice(0, 3)} />);

    expect(screen.queryByRole("button", { name: "التالي" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
