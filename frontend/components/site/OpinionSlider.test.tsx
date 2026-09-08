import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OpinionSlider from "./OpinionSlider";

vi.mock("next/image", () => ({
  default: ({ src, alt, fill: _fill, ...rest }: any) => <img src={src} alt={alt} {...rest} />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const items = [
  { name: "د. سامية عبد الغني", quote: "الاقتصاد المصري بين تحديين", href: "/opinion/a", initial: "س", avatar: "/media/avatars/s.jpg" },
  { name: "محمود سلطان", quote: "قراءة في المشهد السياسي", href: "/opinion/b", initial: "م" },
];

describe("OpinionSlider", () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any;
  });

  it("shows every columnist's headline, linked to their piece, with the byline", () => {
    render(<OpinionSlider lang="ar" items={items} seeAllHref="/opinion" />);

    expect(screen.getByText("الاقتصاد المصري بين تحديين").closest("a")).toHaveAttribute("href", "/opinion/a");
    expect(screen.getByText("محمود سلطان")).toBeInTheDocument();
  });

  it("carries the nameplate, a header-level «المزيد» and the paging arrows on one row", () => {
    render(<OpinionSlider lang="ar" items={items} seeAllHref="/opinion" />);

    expect(screen.getByRole("link", { name: "بالعقل والمنطق" })).toHaveAttribute("href", "/opinion");
    expect(screen.getByRole("link", { name: /المزيد/ })).toHaveAttribute("href", "/opinion");
    expect(screen.getByRole("button", { name: "السابق" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "التالي" })).toBeInTheDocument();
  });

  it("uses the writer's portrait as the card photo when the column has no cover", () => {
    const { container } = render(<OpinionSlider lang="ar" items={[items[0]]} seeAllHref="/opinion" />);

    // Once as the card's photo, once in the byline badge.
    expect(container.querySelectorAll('img[src="/media/avatars/s.jpg"]')).toHaveLength(2);
    expect(container.querySelector(".rounded-2xl")).not.toBeNull();
  });

  it("prefers the column's own cover over the portrait", () => {
    const { container } = render(
      <OpinionSlider lang="ar" items={[{ ...items[0], imageSrc: "/media/covers/col.jpg" }]} seeAllHref="/opinion" />,
    );

    expect(container.querySelector('img[src="/media/covers/col.jpg"]')).not.toBeNull();
  });

  it("falls back to the initial when the writer has no portrait", () => {
    const { container } = render(<OpinionSlider lang="ar" items={[items[1]]} seeAllHref="/opinion" />);

    // The site mark stands in for the photo; the byline shows the initial.
    expect(container.querySelector('img[src="/icon.png"]')).not.toBeNull();
    expect(screen.getByText("م")).toBeInTheDocument();
  });

  it("renders nothing for an empty list", () => {
    const { container } = render(<OpinionSlider lang="ar" items={[]} seeAllHref="/opinion" />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("OpinionSlider — byline portrait", () => {
  it("keeps the byline portrait inside its own circle — regression: it filled the whole card", () => {
    const { container } = render(<OpinionSlider lang="ar" items={[items[0]]} seeAllHref="/opinion" />);

    const badgeImg = container.querySelectorAll('img[src="/media/avatars/s.jpg"]')[1];
    expect(badgeImg.closest("span.relative")).not.toBeNull();
  });
});
