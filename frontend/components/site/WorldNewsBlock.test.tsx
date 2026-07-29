import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import WorldNewsBlock from "./WorldNewsBlock";
import { sectionColor } from "@/lib/sections";

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

const cards = Array.from({ length: 8 }, (_, i) => ({
  href: `/article/w${i}`,
  title: `عنوان ${i}`,
  label: i === 0 ? "سياسة" : undefined,
  time: "منذ ساعة",
  imageSrc: `/media/w${i}.jpg`,
}));

/**
 * «عرب وعالم» is the one section the client asked to look unlike every other:
 * a lead story with a rail beside it and a tile row beneath, explicitly not
 * the grid that «الفن» uses. These lock that shape in place — a regression
 * here reads as "the client's request was quietly undone".
 */
describe("WorldNewsBlock", () => {
  it("renders nothing rather than a bare heading when the feed is empty", () => {
    const { container } = render(<WorldNewsBlock lang="ar" title="عرب وعالم" href="/section/world" cards={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("gives the first story the lead and lays the rest out around it", () => {
    render(<WorldNewsBlock lang="ar" title="عرب وعالم" href="/section/world" cards={cards} />);

    const headings = screen.getAllByRole("heading", { level: 3 });
    // 1 lead + 3 side + 3 tiles = 7; the eighth card is beyond the block.
    expect(headings).toHaveLength(7);
    expect(headings[0]).toHaveTextContent("عنوان 0");
    expect(screen.queryByText("عنوان 7")).not.toBeInTheDocument();

    // The lead's headline is the largest thing in the block — that is what
    // makes it read as a front page rather than another even row of tiles.
    expect(headings[0].className).toContain("clamp(1.125rem");
  });

  it("degrades to just the lead when that is all there is", () => {
    render(<WorldNewsBlock lang="ar" title="عرب وعالم" href="/section/world" cards={cards.slice(0, 1)} />);

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
  });

  it("holds back the tile row until the side rail is full", () => {
    render(<WorldNewsBlock lang="ar" title="عرب وعالم" href="/section/world" cards={cards.slice(0, 4)} />);

    // 1 lead + 3 side, no tiles — and no empty bordered strip under them.
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    expect(document.querySelector(".border-t.border-line")).toBeNull();
  });

  it("paints the category chip in the section's colour", () => {
    const { container } = render(
      <WorldNewsBlock lang="ar" title="عرب وعالم" href="/section/world" cards={cards} sectionKey="world" />,
    );

    const chip = screen.getByText("سياسة");
    expect(chip).toHaveStyle({ backgroundColor: sectionColor("world") });
    // The same key recolours the whole block, which is what lets another
    // section run this layout without a second copy of it.
    expect(container.querySelector("section")!.getAttribute("style")).toContain(sectionColor("world"));
  });

  it("keeps the chip clear of the corner the breaking badge owns", () => {
    render(<WorldNewsBlock lang="ar" title="عرب وعالم" href="/section/world" cards={cards} />);

    // bottom-start, so a breaking world story shows both without stacking.
    expect(screen.getByText("سياسة").className).toContain("bottom-0");
    expect(screen.getByText("سياسة").className).toContain("start-0");
  });

  it("leaves no chip at all when a card has no label", () => {
    render(<WorldNewsBlock lang="ar" title="عرب وعالم" href="/section/world" cards={[{ ...cards[1], label: undefined }]} />);

    expect(screen.queryByText("سياسة")).not.toBeInTheDocument();
  });

  it("points every card at its article", () => {
    render(<WorldNewsBlock lang="ar" title="عرب وعالم" href="/section/world" cards={cards} />);

    expect(screen.getByRole("link", { name: /عنوان 0/ })).toHaveAttribute("href", "/article/w0");
    expect(screen.getByRole("link", { name: /عنوان 6/ })).toHaveAttribute("href", "/article/w6");
  });
});
