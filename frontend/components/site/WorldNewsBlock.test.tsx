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

  it("sets the lead's headline in white directly on the photo, over a dark gradient — the client's own reference", () => {
    const { container } = render(<WorldNewsBlock lang="ar" title="عرب وعالم" href="/section/world" cards={cards} />);

    const heading = screen.getByRole("heading", { level: 3, name: "عنوان 0" });
    expect(heading).toHaveClass("text-paper");
    expect(container.querySelector('[class*="from-\\[rgba(10,11,13"]')).not.toBeNull();
  });

  it("shows the lead's time in a light colour so it reads over the dark gradient, not the plain ink used elsewhere", () => {
    render(<WorldNewsBlock lang="ar" title="عرب وعالم" href="/section/world" cards={cards} />);

    const lead = screen.getByRole("link", { name: /عنوان 0/ });
    expect(lead.querySelector(".text-paper\\/85")).not.toBeNull();
  });

  it("holds back the tile row until the side rail is full", () => {
    render(<WorldNewsBlock lang="ar" title="عرب وعالم" href="/section/world" cards={cards.slice(0, 4)} />);

    // 1 lead + 3 side, no tiles — and no empty bordered strip under them.
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    expect(document.querySelector(".border-t.border-line")).toBeNull();
  });

  it("paints the chip flat red, regardless of the section — the client's own reference for this block", () => {
    const { container } = render(
      <WorldNewsBlock lang="ar" title="عرب وعالم" href="/section/world" cards={cards} sectionKey="world" />,
    );

    const chip = screen.getByText("سياسة");
    expect(chip).toHaveClass("bg-badge-breaking");
    // sectionKey still recolours the heading rule and headline hover even
    // though the chip itself no longer follows it.
    expect(container.querySelector("section")!.getAttribute("style")).toContain(sectionColor("world"));
  });

  it("keeps the chip clear of the corner the breaking badge owns", () => {
    render(<WorldNewsBlock lang="ar" title="عرب وعالم" href="/section/world" cards={cards} />);

    // Anywhere but the top-start corner, which «عاجل»/«خاص» owns, so a
    // breaking world story shows both without them stacking.
    expect(screen.getByText("سياسة").className).not.toMatch(/\btop-\d/);
  });

  it("regression: the chip and the timestamp share one row instead of stacking on the same corner", () => {
    // Reported by the client: the red country tag («آسيا», «أمريكا
    // اللاتينية») lay across the publish time and made it unreadable. Both
    // were anchored to the photo's bottom-start corner — the chip
    // absolutely, the time inside the overlay's padding box.
    render(<WorldNewsBlock lang="ar" title="عرب وعالم" href="/section/world" cards={cards} />);

    const chip = screen.getByText("سياسة");
    // Nothing absolutely positioned: it can only be laid out beside the time.
    expect(chip.className).not.toContain("absolute");
    const row = chip.parentElement!;
    expect(row.className).toContain("justify-between");
    expect(row).toHaveTextContent("منذ ساعة");
  });

  it("wraps the pair rather than letting them collide on a narrow card", () => {
    render(<WorldNewsBlock lang="ar" title="عرب وعالم" href="/section/world" cards={cards} />);

    expect(screen.getByText("سياسة").parentElement!.className).toContain("flex-wrap");
  });

  it("leaves the time at the inline start on a card with no chip", () => {
    // justify-between with a single child: a chipless card looks exactly as
    // it always did, with nothing pushed to the far edge on its own.
    const noChip = [{ ...cards[0], label: undefined }, ...cards.slice(1)];
    render(<WorldNewsBlock lang="ar" title="عرب وعالم" href="/section/world" cards={noChip} />);

    const lead = screen.getByRole("link", { name: /عنوان 0/ });
    expect(lead.querySelector(".text-paper\\/85")).toHaveTextContent("منذ ساعة");
    expect(lead.querySelectorAll(".justify-between > *")).toHaveLength(1);
  });

  it("truncates an over-long label on the side rail's thumbnail instead of slicing it mid-word", () => {
    // 112px of thumbnail can't seat «أمريكا اللاتينية», and the thumbnail
    // clips its overflow — so the chip has to cut itself, visibly.
    const withLongLabel = cards.map((c, i) => (i === 1 ? { ...c, label: "أمريكا اللاتينية" } : c));
    render(<WorldNewsBlock lang="ar" title="عرب وعالم" href="/section/world" cards={withLongLabel} />);

    const chip = screen.getByText("أمريكا اللاتينية");
    expect(chip.className).toContain("truncate");
    expect(chip.className).toContain("max-w-[calc(100%-1rem)]");
  });

  it("gives a side item its topic kicker when the chip is spent on the country", () => {
    // With «الكويت» on the photo, the topic still needs somewhere to go.
    const withKicker = cards.map((c, i) => (i === 1 ? { ...c, label: "الكويت", kicker: "دبلوماسية" } : c));
    render(<WorldNewsBlock lang="ar" title="عرب وعالم" href="/section/world" cards={withKicker} sectionKey="world" />);

    expect(screen.getByText("الكويت")).toBeInTheDocument();
    expect(screen.getByText("دبلوماسية")).toBeInTheDocument();
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
