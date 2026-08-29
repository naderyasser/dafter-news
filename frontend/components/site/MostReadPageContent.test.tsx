import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MostReadPageContent from "./MostReadPageContent";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, fill, priority, sizes, ...rest }: any) => <img src={typeof src === "string" ? src : ""} alt={alt} {...rest} />,
}));

const rows = Array.from({ length: 10 }, (_, i) => ({
  title: `خبر رقم ${i + 1}`,
  section: "قسم",
  href: `/article/story-${i + 1}`,
}));

describe("MostReadPageContent", () => {
  it("shows each story's cover, and a quiet placeholder when there is none", () => {
    const withImages = [
      { ...rows[0], imageSrc: "/media/covers/top.jpg" },
      rows[1], // no cover
    ];
    const { container } = render(<MostReadPageContent rows={withImages} />);

    // The homepage widget carries thumbs; this page is its «عرض الكل»
    // destination — bare text here read as the images failing to load.
    expect(container.querySelector('img[src="/media/covers/top.jpg"]')).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelectorAll(".bg-surface-2")).toHaveLength(1);
  });

  it("keeps the real ranking order when switching to Week or Month", () => {
    render(<MostReadPageContent rows={rows} />);

    // Day: the first row (the site's actual top-viewed article) leads.
    const dayTitles = screen.getAllByText(/^خبر رقم/).map((el) => el.textContent);
    expect(dayTitles[0]).toBe("خبر رقم 1");

    // Week must not fabricate an inverted ranking — no real per-period data
    // exists, so it should show the same true order, not `rows` reversed.
    fireEvent.click(screen.getByText("الأسبوع"));
    const weekTitles = screen.getAllByText(/^خبر رقم/).map((el) => el.textContent);
    expect(weekTitles).toEqual(dayTitles);

    // Month must not fabricate a rotated ranking either.
    fireEvent.click(screen.getByText("الشهر"));
    const monthTitles = screen.getAllByText(/^خبر رقم/).map((el) => el.textContent);
    expect(monthTitles).toEqual(dayTitles);
  });

  it("captions a row with its section alone, never the read count", () => {
    // This page is the widget's «عرض الكل» destination and follows the same
    // caption rule: section only, even when the caller passes `views`.
    render(<MostReadPageContent rows={[{ ...rows[0], views: 150 }]} />);

    const row = screen.getByText("خبر رقم 1").closest("a")!;
    expect(row).toHaveTextContent("قسم");
    expect(row.textContent).not.toContain("قراءة");
    expect(row.textContent).not.toContain("١٥٠");
    expect(row.textContent).not.toContain("·");
  });

  it("renders a row with no count at all, leaving no stray separator", () => {
    render(<MostReadPageContent rows={[{ title: "بلا عداد", section: "قسم", href: "/article/y" }]} />);

    const row = screen.getByText("بلا عداد").closest("a")!;
    expect(row).toHaveTextContent("قسم");
    expect(row.textContent).not.toContain("·");
  });
});
