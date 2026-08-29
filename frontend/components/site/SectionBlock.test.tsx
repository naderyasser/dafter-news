import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SectionBlock from "./SectionBlock";
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

const cards = Array.from({ length: 6 }, (_, i) => ({
  href: `/article/a${i}`,
  title: `خبر رقم ${i}`,
  section: "شؤون مصر",
  time: "منذ ساعة",
}));

describe("SectionBlock", () => {
  it("caps the block at its limit rather than expanding in place", () => {
    // The newsroom asked for a fixed number of stories per block, with a
    // reader who wants more sent to the desk itself.
    render(<SectionBlock lang="ar" title="شؤون مصر" seeAllHref="/section/egypt" cards={cards} initialCount={4} />);

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    expect(screen.queryByText("خبر رقم 5")).not.toBeInTheDocument();
    // No in-place expander any more — the only way on is the desk link.
    expect(screen.queryByRole("button", { name: /المزيد/ })).not.toBeInTheDocument();
  });

  it("still offers the desk link when everything already fits", () => {
    render(<SectionBlock lang="ar" title="شؤون مصر" seeAllHref="/section/egypt" cards={cards.slice(0, 3)} initialCount={4} />);

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
    expect(screen.getByRole("link", { name: /المزيد/ })).toHaveAttribute("href", "/section/egypt");
  });

  it("shows every card when no limit is given", () => {
    render(<SectionBlock lang="ar" title="شؤون مصر" seeAllHref="/section/egypt" cards={cards} />);

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(6);
  });

  it("puts «المزيد» at the foot of the block as a real link", () => {
    render(<SectionBlock lang="ar" title="شؤون مصر" seeAllHref="/section/egypt" cards={cards} initialCount={4} />);

    // It navigates to the desk — the top-corner «عرض الكل» it replaced was
    // the least-pressed control on the block.
    const more = screen.getByRole("link", { name: /المزيد/ });
    expect(more).toHaveAttribute("href", "/section/egypt");
    expect(more.tagName).toBe("A");
  });

  it("dresses the block in the section's own colour", () => {
    const { container } = render(
      <SectionBlock lang="ar" title="جوّه الجون" seeAllHref="/section/sports" cards={cards} sectionKey="sports" />,
    );

    const block = container.querySelector("section")!;
    expect(block.getAttribute("style")).toContain(sectionColor("sports"));
    // ...and carries the subject watermark rather than a bare panel.
    expect(block.getAttribute("style")).toContain("--wm-image");
  });

  it("falls back to accent blue and no watermark for a section it has never heard of", () => {
    const { container } = render(
      <SectionBlock lang="ar" title="قسم جديد" seeAllHref="/section/brand-new" cards={cards} sectionKey="brand-new" />,
    );

    const block = container.querySelector("section")!;
    // A section added in the dashboard must never render as a broken block.
    expect(block.getAttribute("style")).toContain(sectionColor(null));
    expect(block.getAttribute("style")).not.toContain("--wm-image");
  });

  it("speaks English on the English edition", () => {
    render(<SectionBlock lang="en" title="Egypt" seeAllHref="/en/section/egypt" cards={cards} initialCount={4} />);

    // The foot button is the only "onward" control now, in both editions.
    expect(screen.getByRole("link", { name: /More/ })).toHaveAttribute("href", "/en/section/egypt");
  });

  it("swaps the plain heading for the photo masthead once a cover image is set", () => {
    render(
      <SectionBlock
        lang="ar"
        title="سياسة"
        seeAllHref="/section/pol"
        cards={cards}
        sectionKey="pol"
        coverImage="/media/sections/pol.jpg"
        tagline="آخر تطورات المشهد السياسي"
      />,
    );

    expect(screen.getByText("آخر تطورات المشهد السياسي")).toBeInTheDocument();
    // Still just one "عرض الكل"-style link — the masthead's own, not a second
    // heading stacked underneath it.
    expect(screen.getAllByRole("link", { name: /عرض الكل/ })).toHaveLength(1);
  });

  it("keeps the plain heading when no cover image is set", () => {
    render(<SectionBlock lang="ar" title="سياسة" seeAllHref="/section/pol" cards={cards} sectionKey="pol" />);

    expect(screen.queryByText("آخر تطورات المشهد السياسي")).not.toBeInTheDocument();
    // The nameplate links to the desk, and so does the foot button.
    expect(screen.getAllByRole("link", { name: /سياسة|المزيد/ }).length).toBeGreaterThan(0);
  });

  it("renders nothing for an empty list, rather than a heading over an empty grid", () => {
    // Every sibling homepage block (HeroSlider, VideoShowcase, SportsBlock,
    // SpecialFilesBlock, WorldNewsBlock) hides itself the same way on a
    // quiet day — this is the fallback block for a dashboard-added section,
    // so it's the one most likely to actually hit zero.
    const { container } = render(<SectionBlock lang="ar" title="قسم جديد" seeAllHref="/section/brand-new" cards={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
