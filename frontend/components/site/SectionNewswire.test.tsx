import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SectionNewswire from "./SectionNewswire";

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

const cards = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  href: `/article/n${i}`,
  title: `خبر رقم ${i}`,
  section: "شؤون مصر",
  time: "منذ ساعة",
  badge: "none" as const,
  imageSrc: `/media/n${i}.jpg`,
  // Ascending views, so the last card is the most read.
  views: i * 10,
}));

/**
 * The fast-news archetype. A political or crime desk is scanned, so the
 * page must put the desk's lead first and then fit as many headlines as it
 * can — these lock that in against a drift back to an even photo grid.
 */
describe("SectionNewswire", () => {
  it("renders nothing rather than an empty frame when the desk has filed nothing", () => {
    const { container } = render(<SectionNewswire lang="ar" cards={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("gives the newest story the lead, at the largest size on the page", () => {
    render(<SectionNewswire lang="ar" cards={cards} />);

    const lead = screen.getByRole("heading", { level: 2 });
    expect(lead).toHaveTextContent("خبر رقم 0");
    expect(lead.className).toContain("text-paper");
  });

  it("runs the rest as a dense list, not a card grid", () => {
    const { container } = render(<SectionNewswire lang="ar" cards={cards} />);

    // The compact row's square list thumbnail is the tell; a standard card
    // carries a 16:9 photo instead.
    expect(container.querySelectorAll(".aspect-square").length).toBeGreaterThan(4);
  });

  it("paginates past the first eight rows", () => {
    render(<SectionNewswire lang="ar" cards={cards} />);

    // 14 cards: 1 lead + 13 rows → two pages of 8.
    expect(screen.queryByText("خبر رقم 12")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("2"));
    expect(screen.getByText("خبر رقم 12")).toBeInTheDocument();
  });

  it("drops the lead on later pages so the list keeps its place", () => {
    render(<SectionNewswire lang="ar" cards={cards} />);

    fireEvent.click(screen.getByText("2"));
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("reorders by views when «الأكثر قراءة» is chosen", () => {
    render(<SectionNewswire lang="ar" cards={cards} />);

    fireEvent.click(screen.getByText("الأكثر قراءة"));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("خبر رقم 13");
  });

  it("paints the active tab in the section's own colour", () => {
    render(<SectionNewswire lang="ar" cards={cards} accent="#12793F" />);

    expect(screen.getByText("الأحدث")).toHaveStyle({ backgroundColor: "#12793F" });
  });

  it("uses Latin numerals and English tabs on the English edition", () => {
    render(<SectionNewswire lang="en" cards={cards} />);

    expect(screen.getByText("Latest")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
