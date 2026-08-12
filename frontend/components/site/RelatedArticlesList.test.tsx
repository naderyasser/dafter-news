import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RelatedArticlesList from "./RelatedArticlesList";

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

const cards = Array.from({ length: 4 }, (_, i) => ({
  href: `/article/r${i}`,
  title: `عنوان ${i}`,
  time: "منذ ساعة",
  imageSrc: `/media/r${i}.jpg`,
}));

describe("RelatedArticlesList", () => {
  it("renders nothing when there is nothing related", () => {
    const { container } = render(<RelatedArticlesList lang="ar" title="أخبار ذات صلة" cards={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("lists every card as a compact row, not a grid", () => {
    render(<RelatedArticlesList lang="ar" title="أخبار ذات صلة" cards={cards} />);

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    expect(screen.getByText("عنوان 0")).toBeInTheDocument();
    expect(screen.getByText("عنوان 3")).toBeInTheDocument();
  });

  it("points each row at its own article", () => {
    render(<RelatedArticlesList lang="ar" title="أخبار ذات صلة" cards={cards} />);

    expect(screen.getByRole("link", { name: /عنوان 0/ })).toHaveAttribute("href", "/article/r0");
    expect(screen.getByRole("link", { name: /عنوان 2/ })).toHaveAttribute("href", "/article/r2");
  });

  it("speaks English on the English edition", () => {
    render(<RelatedArticlesList lang="en" title="Related news" cards={cards} />);

    expect(screen.getByText("Related news")).toBeInTheDocument();
  });
});
