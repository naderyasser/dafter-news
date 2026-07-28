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

const rows = Array.from({ length: 10 }, (_, i) => ({
  title: `خبر رقم ${i + 1}`,
  section: "قسم",
  href: `/article/story-${i + 1}`,
}));

describe("MostReadPageContent", () => {
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
});
