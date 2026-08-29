import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import OpinionCarousel from "./OpinionCarousel";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const items = [
  { name: "د. سامية عبد الغني", quote: "الاقتصاد المصري بين تحديين", href: "/opinion/a", initial: "س" },
  { name: "محمود سلطان", quote: "قراءة في المشهد السياسي", href: "/opinion/b", initial: "م" },
];

describe("OpinionCarousel", () => {
  it("shows every columnist's quote, linked to their piece", () => {
    render(<OpinionCarousel lang="ar" items={items} seeAllHref="/opinion" />);

    expect(screen.getByText("الاقتصاد المصري بين تحديين").closest("a")).toHaveAttribute("href", "/opinion/a");
    expect(screen.getByText("محمود سلطان")).toBeInTheDocument();
  });

  it("shows the publish date beside the columnist's name — regression: the carousel carried no date at all", () => {
    render(
      <OpinionCarousel
        lang="ar"
        items={[{ ...items[0], time: "منذ ٣ ساعات" }]}
        seeAllHref="/opinion"
      />,
    );

    expect(screen.getByText("منذ ٣ ساعات")).toBeInTheDocument();
  });

  it("shows no date line for a piece with none, rather than an empty one", () => {
    render(<OpinionCarousel lang="ar" items={items} seeAllHref="/opinion" />);

    const nameEl = screen.getByText("د. سامية عبد الغني");
    // The name sits alone in its wrapper when there's no date to go under it.
    expect(nameEl.parentElement?.children).toHaveLength(1);
  });

  it("renders nothing for an empty list, rather than a heading with dead arrow buttons over it", () => {
    // Every sibling homepage band (HeroSlider, VideoShowcase, SportsBlock,
    // SpecialFilesBlock) hides itself the same way on a quiet day.
    const { container } = render(<OpinionCarousel lang="ar" items={[]} seeAllHref="/opinion" />);

    expect(container).toBeEmptyDOMElement();
  });
});
