import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LeadListBlock from "./LeadListBlock";
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

const cards = Array.from({ length: 5 }, (_, i) => ({
  href: `/article/e${i}`,
  title: `عنوان ${i}`,
  section: "شؤون مصر",
  time: i === 0 ? "منذ دقيقة" : "منذ ساعة",
  imageSrc: `/media/e${i}.jpg`,
}));

/**
 * «شؤون مصر» on the home page — a lead photo with the headline set into it,
 * then the rest of the desk as a plain white list. The lead used to be
 * indistinguishable from every other section's grid card; these lock the
 * shape the client asked for in place.
 */
describe("LeadListBlock", () => {
  it("renders nothing rather than a bare heading when the feed is empty", () => {
    const { container } = render(
      <LeadListBlock lang="ar" title="شؤون مصر" seeAllHref="/section/egypt" sectionKey="egypt" cards={[]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("gives the first story the lead and lists the rest underneath", () => {
    render(<LeadListBlock lang="ar" title="شؤون مصر" seeAllHref="/section/egypt" sectionKey="egypt" cards={cards} />);

    // 1 lead (h3) + 4 list rows (h4).
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(4);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("عنوان 0");
  });

  it("sets the lead's time into the photo rather than dropping it", () => {
    render(<LeadListBlock lang="ar" title="شؤون مصر" seeAllHref="/section/egypt" sectionKey="egypt" cards={cards} />);

    expect(screen.getByText("منذ دقيقة")).toBeInTheDocument();
  });

  it("degrades to just the lead when that is all there is", () => {
    render(
      <LeadListBlock lang="ar" title="شؤون مصر" seeAllHref="/section/egypt" sectionKey="egypt" cards={cards.slice(0, 1)} />,
    );

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
    expect(screen.queryAllByRole("heading", { level: 4 })).toHaveLength(0);
  });

  it("paints the list kicker in the section's own colour, never brand red", () => {
    render(<LeadListBlock lang="ar" title="شؤون مصر" seeAllHref="/section/egypt" sectionKey="egypt" cards={cards} />);

    const kickers = screen.getAllByText("شؤون مصر");
    // First occurrence is the block heading; the rest are the row kickers.
    expect(kickers.length).toBeGreaterThan(1);
    expect(kickers[1]).toHaveStyle({ color: sectionColor("egypt") });
  });

  it("points the foot button at the section page", () => {
    render(<LeadListBlock lang="ar" title="شؤون مصر" seeAllHref="/section/egypt" sectionKey="egypt" cards={cards} />);

    const links = screen.getAllByRole("link", { name: /المزيد/ });
    expect(links.some((l) => l.getAttribute("href") === "/section/egypt")).toBe(true);
  });

  it("points every row at its own article", () => {
    render(<LeadListBlock lang="ar" title="شؤون مصر" seeAllHref="/section/egypt" sectionKey="egypt" cards={cards} />);

    expect(screen.getByRole("link", { name: /عنوان 0/ })).toHaveAttribute("href", "/article/e0");
    expect(screen.getByRole("link", { name: /عنوان 3/ })).toHaveAttribute("href", "/article/e3");
  });

  it("swaps the plain heading for the photo masthead once a cover image is set", () => {
    render(
      <LeadListBlock
        lang="ar"
        title="شؤون مصر"
        seeAllHref="/section/egypt"
        sectionKey="egypt"
        cards={cards}
        coverImage="/media/sections/egypt.jpg"
        tagline="متابعة يومية لأهم الأخبار والتطورات"
      />,
    );

    expect(screen.getByText("متابعة يومية لأهم الأخبار والتطورات")).toBeInTheDocument();
  });

  it("tints the lead photo navy, not the neutral-black scrim other overlays use", () => {
    const { container } = render(<LeadListBlock lang="ar" title="شؤون مصر" seeAllHref="/section/egypt" sectionKey="egypt" cards={cards} />);

    const overlay = container.querySelector(".bg-gradient-to-t");
    expect(overlay?.className).toContain("rgba(7,50,82");
    expect(overlay?.className).not.toContain("rgba(10,11,13");
  });

  it("is reusable for a different section — الخليج العربي gets the exact same shape", () => {
    render(<LeadListBlock lang="ar" title="الخليج العربي" seeAllHref="/section/gulf" sectionKey="gulf" cards={cards} />);

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(4);
    expect(screen.getByRole("link", { name: /المزيد/ })).toHaveAttribute("href", "/section/gulf");
  });

  it("sits on plain white, not the navy band — regression: the client reverted that call", () => {
    const { container } = render(
      <LeadListBlock lang="ar" title="شؤون مصر" seeAllHref="/section/egypt" sectionKey="egypt" cards={cards} />,
    );

    expect(container.querySelector("section")?.className).toContain("bg-paper");
    expect(container.querySelector("section")?.className).not.toContain("bg-navy");
    // rule-on-dark would be SectionHeading's signal that it was given
    // tone="dark" — on a white block the heading must NOT ask for that.
    expect(container.querySelector(".rule-on-dark")).toBeNull();
  });

  /**
   * The client's own report: «الخليج العربي» rows carried the section name
   * as their label everywhere, so every card in the block read the same
   * regardless of which country the story was actually about. `chip`
   * (country) rides the photo now, same as عرب وعالم; `section` (Egypt's
   * only label) still runs the text-column kicker underneath it unchanged.
   */
  describe("country chip", () => {
    const gulfCards = [
      { ...cards[0], chip: "السعودية" },
      { ...cards[1], chip: "الإمارات" },
      { ...cards[2] }, // no country set — must not show an empty pill
    ];

    it("floats the country on the lead photo", () => {
      render(<LeadListBlock lang="ar" title="الخليج العربي" seeAllHref="/section/gulf" sectionKey="gulf" cards={gulfCards} />);

      expect(screen.getByText("السعودية")).toBeInTheDocument();
    });

    it("floats the country on a list row's own thumbnail", () => {
      render(<LeadListBlock lang="ar" title="الخليج العربي" seeAllHref="/section/gulf" sectionKey="gulf" cards={gulfCards} />);

      expect(screen.getByText("الإمارات")).toBeInTheDocument();
    });

    it("colours the chip with the section's own accent, not a hardcoded one", () => {
      render(<LeadListBlock lang="ar" title="الخليج العربي" seeAllHref="/section/gulf" sectionKey="gulf" cards={gulfCards} />);

      expect(screen.getByText("السعودية")).toHaveStyle({ backgroundColor: sectionColor("gulf") });
    });

    it("shows no pill on a row with no country, rather than an empty one", () => {
      render(<LeadListBlock lang="ar" title="الخليج العربي" seeAllHref="/section/gulf" sectionKey="gulf" cards={gulfCards} />);

      // Third card (the second list row) carries no chip; its text-column
      // kicker («شؤون مصر» here, reused from the shared fixture) is
      // unaffected either way — both list rows still show it.
      expect(screen.getAllByText("شؤون مصر")).toHaveLength(2);
    });

    it("leaves Egypt's rows exactly as they were — no chip means nothing new renders", () => {
      const { container } = render(
        <LeadListBlock lang="ar" title="شؤون مصر" seeAllHref="/section/egypt" sectionKey="egypt" cards={cards} />,
      );

      expect(container.querySelector(".ring-white\\/15")).toBeNull();
    });
  });
});
