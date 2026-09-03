import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MostReadList from "./MostReadList";

vi.mock("next/image", () => ({
  default: ({ src, alt, fill: _fill, ...rest }: any) => <img src={src} alt={alt} {...rest} />,
}));

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

  it("numbers the Arabic list with Western numerals", () => {
    // The newsroom dropped Eastern numerals site-wide; both editions now
    // rank with Western digits (see lib/format's AR_LOCALE).
    render(<MostReadList lang="ar" items={items} />);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("numbers the English list with Latin digits", () => {
    render(<MostReadList lang="en" items={items} />);

    expect(screen.getByText("1")).toBeInTheDocument();
    // The Eastern digit must not appear in either edition any more.
    expect(screen.queryByText("١")).not.toBeInTheDocument();
  });

  it("gives the rank tabular figures so numbers align", () => {
    render(<MostReadList lang="ar" items={items} />);

    expect(screen.getByText("1").className).toContain("tnum");
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

  it("captions a row with its section alone, never the read count", () => {
    // The caption has carried a timestamp and then a read count; the newsroom
    // asked for both to go. Callers still pass `views` (it is what the API
    // returns and what the ranking is built on), so the guard is that passing
    // it changes nothing on screen.
    render(<MostReadList lang="ar" items={[{ ...items[0], views: 150 }]} />);

    const row = screen.getByText("الحكومة تعلن حزمة دعم").closest("a")!;
    expect(row).toHaveTextContent("مصر");
    expect(row.textContent).not.toContain("قراءة");
    expect(row.textContent).not.toContain("١٥٠");
    expect(row.textContent).not.toContain("·");
  });

  it("drops the count on the English edition too", () => {
    render(<MostReadList lang="en" items={[{ title: "A story", href: "/en/article/x", section: "Egypt", views: 1500 }]} />);

    const row = screen.getByText("A story").closest("a")!;
    expect(row).toHaveTextContent("Egypt");
    expect(row.textContent).not.toContain("reads");
    expect(row.textContent).not.toContain("1,500");
  });

  it("leaves a sectionless row with no empty caption line", () => {
    render(<MostReadList lang="ar" items={[{ title: "خبر بلا قسم", href: "/article/x", views: 9 }]} />);

    const row = screen.getByText("خبر بلا قسم").closest("a")!;
    expect(row.textContent).not.toContain("·");
    expect(row.textContent).not.toContain("قراءات");
  });
});

describe("MostReadList thumbnails", () => {
  // alt="" makes the thumbnail decorative (role=presentation), so query the
  // element directly rather than by the img role.
  const thumb = (container: HTMLElement) => container.querySelector("img");

  it("shows the site mark, not an empty grey box, for a story with no cover", () => {
    const { container } = render(<MostReadList lang="ar" items={[{ title: "بلا غلاف", href: "/article/x", imageSrc: null }]} />);

    expect(thumb(container)).toHaveAttribute("src", "/icon.png");
  });

  it("uses the columnist's portrait for an opinion piece without a cover", () => {
    const { container } = render(
      <MostReadList
        lang="ar"
        items={[{ title: "رأي", href: "/opinion/x", imageSrc: undefined, kind: "opinion", authorAvatar: "/media/avatars/a.jpg" }]}
      />,
    );

    expect(thumb(container)).toHaveAttribute("src", "/media/avatars/a.jpg");
  });
});
