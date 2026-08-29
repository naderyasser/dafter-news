import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SectionHero from "./SectionHero";
import { sectionColor } from "@/lib/sections";

/**
 * The section masthead — where each desk's identity is visible before a
 * single card loads. Colour and mark come from lib/sections, so these lock
 * the wiring, not the palette.
 */
describe("SectionHero", () => {
  it("keeps the section title an h1 — it is the page's heading, band or not", () => {
    render(<SectionHero lang="ar" title="جوّه الجون" sectionKey="sports" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("جوّه الجون");
  });

  it("paints the band in the section's own colour", () => {
    const { container } = render(<SectionHero lang="ar" title="جوّه الجون" sectionKey="sports" />);

    expect(container.firstChild).toHaveStyle({ backgroundColor: sectionColor("sports") });
  });

  it("draws the section's line-art mark behind the title", () => {
    const { container } = render(<SectionHero lang="ar" title="حركة السوق" sectionKey="economy" />);

    const mark = container.querySelector('[style*="data:image/svg+xml"]');
    expect(mark).not.toBeNull();
  });

  it("shows the tagline when the desk has one", () => {
    render(<SectionHero lang="ar" title="ملف خاص" sectionKey="special" tagline="تحقيقات معمّقة تأخذ وقتها" />);

    expect(screen.getByText("تحقيقات معمّقة تأخذ وقتها")).toBeInTheDocument();
  });

  it("counts the desk's stories in Western numerals on the Arabic edition", () => {
    render(<SectionHero lang="ar" title="شؤون مصر" sectionKey="egypt" count={11} />);

    expect(screen.getByText("11 خبر")).toBeInTheDocument();
  });

  it("counts in Latin numerals on the English edition", () => {
    render(<SectionHero lang="en" title="Egypt" sectionKey="egypt" count={11} />);

    expect(screen.getByText("11 stories")).toBeInTheDocument();
  });

  it("falls back to the accent band, no mark, for a dashboard-created section", () => {
    const { container } = render(<SectionHero lang="ar" title="قسم جديد" sectionKey="brand-new" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("قسم جديد");
    expect(container.querySelector('[style*="data:image/svg+xml"]')).toBeNull();
  });
});
