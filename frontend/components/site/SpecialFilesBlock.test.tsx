import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SpecialFilesBlock from "./SpecialFilesBlock";

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

const items = [
  {
    href: "/article/water-file",
    title: "ملف: أمن المياه في مصر",
    imageSrc: "/media/water.jpg",
    authorName: "محمد العدوي",
    authorAvatar: "/media/avatars/adawy.png",
    authorInitial: "م",
  },
  {
    href: "/article/economy-file",
    title: "ملف: الاقتصاد غير الرسمي",
    imageSrc: "/media/econ.jpg",
    authorName: "منى الشربيني",
    authorAvatar: null,
    authorInitial: "م.ش",
  },
];

/**
 * «ملف خاص» is the client's magazine shelf: investigations as tall poster
 * cards on a dark band, signed by the journalist ON the card. These pin the
 * three things that make it that — the poster ratio, the byline chip, and
 * the refusal to render an empty shelf.
 */
describe("SpecialFilesBlock", () => {
  it("renders nothing rather than an empty dark band when the section is empty", () => {
    const { container } = render(<SpecialFilesBlock lang="ar" title="ملف خاص" href="/section/special" items={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows every file with its title, linked to the article", () => {
    render(<SpecialFilesBlock lang="ar" title="ملف خاص" href="/section/special" items={items} />);

    expect(screen.getByText("ملف: أمن المياه في مصر").closest("a")).toHaveAttribute("href", "/article/water-file");
    expect(screen.getByText("ملف: الاقتصاد غير الرسمي")).toBeInTheDocument();
  });

  it("uses the poster ratio, not the news 16:9", () => {
    const { container } = render(<SpecialFilesBlock lang="ar" title="ملف خاص" href="/section/special" items={items} />);

    expect(container.querySelector(".aspect-\\[3\\/4\\]")).not.toBeNull();
    expect(container.querySelector(".aspect-video")).toBeNull();
  });

  it("signs each card with the journalist's face and name", () => {
    render(<SpecialFilesBlock lang="ar" title="ملف خاص" href="/section/special" items={items} />);

    expect(screen.getByText("محمد العدوي")).toBeInTheDocument();
    expect(screen.getByAltText("محمد العدوي")).toHaveAttribute("src", "/media/avatars/adawy.png");
  });

  it("falls back to the initial when a journalist has no photo", () => {
    render(<SpecialFilesBlock lang="ar" title="ملف خاص" href="/section/special" items={items} />);

    expect(screen.getByText("م.ش")).toBeInTheDocument();
  });

  it("links the heading's «عرض الكل» to the section archive", () => {
    render(<SpecialFilesBlock lang="ar" title="ملف خاص" href="/section/special" items={items} />);

    expect(screen.getByText("عرض الكل").closest("a")).toHaveAttribute("href", "/section/special");
  });

  it("sits on the dark band with gold accents, not the news red", () => {
    const { container } = render(<SpecialFilesBlock lang="ar" title="ملف خاص" href="/section/special" items={items} />);

    expect(container.querySelector("section")?.className).toContain("bg-navy");
    expect(container.querySelector(".border-gold")).not.toBeNull();
  });

  it("speaks English on the English edition", () => {
    render(<SpecialFilesBlock lang="en" title="Special Files" href="/en/section/special" items={items} />);

    expect(screen.getByText("See all")).toBeInTheDocument();
    expect(screen.getByText("Investigations & in-depth reports")).toBeInTheDocument();
  });
});
