import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SectionMagazine from "./SectionMagazine";

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

const cards = [
  {
    id: 1,
    href: "/article/file-water",
    title: "ملف: أمن المياه في مصر",
    standfirst: "الأرقام والتحديات في ملف يمتد لعشر سنوات",
    imageSrc: "/m/water.jpg",
    time: "منذ يوم",
    authorName: "محمد العدوي",
    authorAvatar: "/m/adawy.png",
    authorInitial: "م",
  },
  {
    id: 2,
    href: "/article/file-economy",
    title: "ملف: الاقتصاد غير الرسمي",
    standfirst: "كيف يُدمج في المنظومة؟",
    imageSrc: "/m/econ.jpg",
    time: "منذ يومين",
    authorName: "منى الشربيني",
    authorInitial: "م.ش",
  },
];

/**
 * The long-form archetype. These desks are browsed rather than scanned, so
 * the page is built for dwell: a wide opener, a standfirst under every
 * headline, and the writer's byline on the card.
 */
describe("SectionMagazine", () => {
  it("renders nothing when the desk is empty", () => {
    const { container } = render(<SectionMagazine lang="ar" cards={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("opens with the newest file at the widest ratio", () => {
    const { container } = render(<SectionMagazine lang="ar" cards={cards} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("ملف: أمن المياه في مصر");
    expect(container.querySelector(".aspect-\\[21\\/9\\]")).not.toBeNull();
  });

  it("carries the standfirst — the deck is the point on a long-form desk", () => {
    render(<SectionMagazine lang="ar" cards={cards} />);

    expect(screen.getByText("الأرقام والتحديات في ملف يمتد لعشر سنوات")).toBeInTheDocument();
    expect(screen.getByText("كيف يُدمج في المنظومة؟")).toBeInTheDocument();
  });

  it("signs each card with its writer", () => {
    render(<SectionMagazine lang="ar" cards={cards} />);

    expect(screen.getByText("محمد العدوي")).toBeInTheDocument();
    expect(screen.getByAltText("محمد العدوي")).toHaveAttribute("src", "/m/adawy.png");
  });

  it("falls back to the initial for a writer with no photo", () => {
    render(<SectionMagazine lang="ar" cards={cards} />);

    expect(screen.getByText("م.ش")).toBeInTheDocument();
  });

  it("links every card at its article", () => {
    render(<SectionMagazine lang="ar" cards={cards} />);

    expect(screen.getByText("ملف: الاقتصاد غير الرسمي").closest("a")).toHaveAttribute("href", "/article/file-economy");
  });

  it("takes the section's colour on the byline ring", () => {
    const { container } = render(<SectionMagazine lang="ar" cards={cards} accent="#B01F2E" />);

    expect(container.querySelector('[style*="rgb(176, 31, 46)"]')).not.toBeNull();
  });
});
