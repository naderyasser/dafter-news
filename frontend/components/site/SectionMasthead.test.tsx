import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SectionMasthead from "./SectionMasthead";
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

describe("SectionMasthead", () => {
  it("renders the title and tagline over the cover photo", () => {
    render(
      <SectionMasthead lang="ar" title="شؤون مصر" tagline="متابعة يومية لأهم الأخبار" imageSrc="/media/sections/egypt.jpg" sectionKey="egypt" />,
    );

    expect(screen.getByText("شؤون مصر")).toBeInTheDocument();
    expect(screen.getByText("متابعة يومية لأهم الأخبار")).toBeInTheDocument();
  });

  it("skips the tagline paragraph when none is given", () => {
    const { container } = render(<SectionMasthead lang="ar" title="سياسة" imageSrc="/media/sections/pol.jpg" sectionKey="pol" />);

    expect(container.querySelector("p")).toBeNull();
  });

  it("tints the title rule in the section's own colour", () => {
    render(<SectionMasthead lang="ar" title="الخليج العربي" imageSrc="/media/sections/gulf.jpg" sectionKey="gulf" />);

    expect(screen.getByText("الخليج العربي")).toHaveStyle({ "--rule-b": sectionColor("gulf") });
  });

  it("only offers a see-all link when an href is given", () => {
    const { rerender } = render(<SectionMasthead lang="ar" title="سياسة" imageSrc="/media/sections/pol.jpg" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    rerender(<SectionMasthead lang="ar" title="سياسة" imageSrc="/media/sections/pol.jpg" href="/section/pol" />);
    expect(screen.getByRole("link", { name: /عرض الكل/ })).toHaveAttribute("href", "/section/pol");
  });
});
