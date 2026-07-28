import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MostReadList from "./MostReadList";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const items = [
  { title: "الحكومة تعلن حزمة دعم", href: "/article/a", section: "مصر" },
  { title: "ارتفاع مؤشر البورصة", href: "/article/b", section: "اقتصاد" },
  { title: "نجم المنتخب يوجه رسالة", href: "/article/c", section: "رياضة" },
];

describe("MostReadList", () => {
  it("renders every item with its section", () => {
    render(<MostReadList lang="ar" items={items} />);

    expect(screen.getByText("الحكومة تعلن حزمة دعم")).toBeInTheDocument();
    expect(screen.getByText("اقتصاد")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("numbers the Arabic list with Eastern Arabic numerals", () => {
    // Brief §3: ranked lists use ١ ٢ ٣ in Arabic, Latin digits in English.
    render(<MostReadList lang="ar" items={items} />);

    expect(screen.getByText("١")).toBeInTheDocument();
    expect(screen.getByText("٢")).toBeInTheDocument();
    expect(screen.getByText("٣")).toBeInTheDocument();
  });

  it("numbers the English list with Latin digits", () => {
    render(<MostReadList lang="en" items={items} />);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.queryByText("١")).not.toBeInTheDocument();
  });

  it("gives the rank tabular figures so numbers align", () => {
    render(<MostReadList lang="ar" items={items} />);

    expect(screen.getByText("١").className).toContain("tnum");
  });

  it("uses the default heading per language", () => {
    const { unmount } = render(<MostReadList lang="ar" items={items} />);
    expect(screen.getByText("الأكثر قراءة")).toBeInTheDocument();
    unmount();

    render(<MostReadList lang="en" items={items} />);
    expect(screen.getByText("Most read")).toBeInTheDocument();
  });

  it("accepts a heading override", () => {
    render(<MostReadList lang="ar" items={items} heading="الأكثر تعليقاً" />);

    expect(screen.getByText("الأكثر تعليقاً")).toBeInTheDocument();
  });

  it("carries the notebook-margin rule on its heading", () => {
    // Brief §1: the rule is allowed on sidebar box headings. It used to be a
    // plain red border; it is now the two-tone red/blue `.rule-accent` bar
    // taken from the brand mark, so the assertion follows the class rather
    // than the border utilities it replaced.
    render(<MostReadList lang="ar" items={items} />);

    const heading = screen.getByText("الأكثر قراءة");
    expect(heading.className).toContain("rule-accent");
  });

  it("uses a logical inline-start border, never a physical one", () => {
    // regression: the rule is drawn with inset-inline-start in globals.css, so
    // what this now guards is that no physical border crept back in beside it.
    render(<MostReadList lang="ar" items={items} />);

    expect(screen.getByText("الأكثر قراءة").className).not.toMatch(/border-l-|border-r-/);
  });

  it("drops the divider on the final row only", () => {
    const { container } = render(<MostReadList lang="ar" items={items} />);
    const links = Array.from(container.querySelectorAll("a"));

    expect(links[0].className).toContain("border-b");
    expect(links[links.length - 1].className).not.toContain("border-b");
  });

  it("renders nothing but the heading for an empty list", () => {
    render(<MostReadList lang="ar" items={[]} />);

    expect(screen.getByText("الأكثر قراءة")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
