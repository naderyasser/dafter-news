import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TrendingTags from "./TrendingTags";
import type { TrendingTag } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const tag = (over: Partial<TrendingTag>): TrendingTag => ({
  id: 1,
  name: "#مصر",
  slug: "مصر",
  article_count: 48,
  week_count: 3,
  last_used: "2026-09-08T10:00:00Z",
  is_hot: true,
  ...over,
});

describe("TrendingTags", () => {
  it("renders each tag as a pill linking to its page, with its story count", () => {
    render(<TrendingTags lang="ar" tags={[tag({}), tag({ id: 2, name: "#إيران", slug: "إيران", article_count: 37, is_hot: false })]} />);

    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/tag/مصر");
    expect(links[0].className).toContain("rounded-full");
    expect(screen.getByText("48")).toBeInTheDocument();
    expect(screen.getByText("37")).toBeInTheDocument();
  });

  it("marks only the hot tags with the flame", () => {
    const { container } = render(
      <TrendingTags lang="ar" tags={[tag({}), tag({ id: 2, name: "#بورصة", slug: "borsa", is_hot: false })]} />,
    );

    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /#مصر/ })).toHaveAttribute("title", "رائج الآن");
    expect(screen.getByRole("link", { name: /#بورصة/ })).not.toHaveAttribute("title");
  });

  it("routes the English edition to /en/tag", () => {
    render(<TrendingTags lang="en" tags={[tag({ name: "Egypt", slug: "egypt" })]} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/en/tag/egypt");
    expect(screen.getByText("Trending tags")).toBeInTheDocument();
  });

  it("renders nothing when no tag has moved — never a heading over an empty box", () => {
    const { container } = render(<TrendingTags lang="ar" tags={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
