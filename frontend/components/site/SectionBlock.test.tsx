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
  it("shows only the initial slice and reveals the rest on request", async () => {
    render(<SectionBlock lang="ar" title="شؤون مصر" seeAllHref="/section/egypt" cards={cards} initialCount={4} />);

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    expect(screen.queryByText("خبر رقم 5")).not.toBeInTheDocument();

    await act(async () => screen.getByRole("button", { name: /عرض المزيد/ }).click());

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(6);
    // The control is gone once there is nothing left behind it.
    expect(screen.queryByRole("button", { name: /عرض المزيد/ })).not.toBeInTheDocument();
  });

  it("offers no expander when everything already fits", () => {
    render(<SectionBlock lang="ar" title="شؤون مصر" seeAllHref="/section/egypt" cards={cards.slice(0, 3)} initialCount={4} />);

    expect(screen.queryByRole("button", { name: /عرض المزيد/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });

  it("shows every card when no limit is given", () => {
    render(<SectionBlock lang="ar" title="شؤون مصر" seeAllHref="/section/egypt" cards={cards} />);

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(6);
  });

  it("keeps «عرض المزيد» distinct from «عرض الكل» — one expands, the other leaves", () => {
    render(<SectionBlock lang="ar" title="شؤون مصر" seeAllHref="/section/egypt" cards={cards} initialCount={4} />);

    // The archive link navigates.
    expect(screen.getByRole("link", { name: /عرض الكل/ })).toHaveAttribute("href", "/section/egypt");
    // The expander does not — it is a button, and a link would have sent the
    // reader away from the cards they asked to see.
    expect(screen.getByRole("button", { name: /عرض المزيد/ }).tagName).toBe("BUTTON");
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

    expect(screen.getByRole("button", { name: /Show more/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /See all/ })).toBeInTheDocument();
  });
});
