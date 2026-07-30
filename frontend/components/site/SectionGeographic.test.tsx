import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SectionGeographic from "./SectionGeographic";

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
  { href: "/article/g1", title: "الكويت تعلن فائضاً", kicker: "اقتصاد", country: "الكويت", time: "منذ يوم", imageSrc: "/m/1.jpg" },
  { href: "/article/g2", title: "قطر توسّع الغاز", kicker: "طاقة", country: "قطر", time: "منذ يومين", imageSrc: "/m/2.jpg" },
  { href: "/article/g3", title: "الكويت تفتتح المتحف", country: "الكويت", time: "منذ 3 أيام", imageSrc: "/m/3.jpg" },
  { href: "/article/g4", title: "خبر بلا دولة", kicker: "سياسة", time: "منذ 4 أيام", imageSrc: "/m/4.jpg" },
];

/**
 * The geographic archetype, built to the client's reference: country tabs,
 * the lead's headline on a dark band over the photo, and the rest of the
 * desk gathered into one panel of thumb-and-kicker rows.
 */
describe("SectionGeographic", () => {
  const renderBlock = (items = cards) => render(<SectionGeographic lang="ar" cards={items} />);

  it("builds the country tabs from countries that actually have stories", () => {
    renderBlock();

    expect(screen.getByRole("button", { name: "الآن" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "الكويت" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "قطر" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "السعودية" })).not.toBeInTheDocument();
  });

  it("sets the lead's headline on the dark band, largest on the page", () => {
    renderBlock();

    const lead = screen.getByRole("heading", { level: 2 });
    expect(lead).toHaveTextContent("الكويت تعلن فائضاً");
    expect(lead.className).toContain("text-paper");
  });

  it("gathers the rest into package rows with their kickers", () => {
    renderBlock();

    expect(screen.getByText("طاقة")).toBeInTheDocument();
    expect(screen.getByText("سياسة")).toBeInTheDocument();
    // A row with no kicker falls back to its country.
    expect(screen.getByText("الكويت تفتتح المتحف").closest("a")!.textContent).toContain("الكويت");
  });

  it("narrows the package to one country and re-leads with its newest story", () => {
    renderBlock();

    fireEvent.click(screen.getByRole("button", { name: "قطر" }));

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("قطر توسّع الغاز");
    expect(screen.queryByText("الكويت تعلن فائضاً")).not.toBeInTheDocument();
  });

  it("restores the full desk through «الآن»", () => {
    renderBlock();

    fireEvent.click(screen.getByRole("button", { name: "قطر" }));
    fireEvent.click(screen.getByRole("button", { name: "الآن" }));

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("الكويت تعلن فائضاً");
  });

  it("hides the tab row when there is nothing to filter by", () => {
    renderBlock([cards[0], { ...cards[2], href: "/article/g5" }]);

    expect(screen.queryByRole("button", { name: "الآن" })).not.toBeInTheDocument();
  });

  it("links the lead and every package row at its article", () => {
    renderBlock();

    expect(screen.getByText("الكويت تعلن فائضاً").closest("a")).toHaveAttribute("href", "/article/g1");
    expect(screen.getByText("خبر بلا دولة").closest("a")).toHaveAttribute("href", "/article/g4");
  });
});
