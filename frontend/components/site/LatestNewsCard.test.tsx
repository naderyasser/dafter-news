import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LatestNewsCard from "./LatestNewsCard";

vi.mock("next/image", () => ({
  default: ({ src, alt, fill, priority, sizes, ...rest }: any) => <img src={typeof src === "string" ? src : ""} alt={alt} {...rest} />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const latest = [
  { href: "/article/l1", title: "خبر جديد أول", imageSrc: "https://x/l1.jpg" },
  { href: "/article/l2", title: "خبر جديد ثانٍ" },
];
// Deliberately not "الأكثر قراءة" — that's the tab's own label, and a
// fixture that collides with it would make a query pass on the button.
const mostRead = [{ href: "/article/m1", title: "الخبر الأكثر تصفحاً" }];

describe("LatestNewsCard", () => {
  it("opens on the latest-news tab", () => {
    render(<LatestNewsCard lang="ar" latest={latest} mostRead={mostRead} />);

    expect(screen.getByText("خبر جديد أول")).toBeInTheDocument();
    expect(screen.queryByText("الخبر الأكثر تصفحاً")).not.toBeInTheDocument();
  });

  it("swaps to the most-read list — and only the list — on the other tab", async () => {
    render(<LatestNewsCard lang="ar" latest={latest} mostRead={mostRead} />);

    await act(async () => screen.getByRole("button", { name: "الأكثر قراءة" }).click());

    expect(screen.getByText("الخبر الأكثر تصفحاً")).toBeInTheDocument();
    expect(screen.queryByText("خبر جديد أول")).not.toBeInTheDocument();
  });

  it("fills the active tab with the brand red, never the inactive one", async () => {
    render(<LatestNewsCard lang="ar" latest={latest} mostRead={mostRead} />);
    const [latestTab, mostReadTab] = screen.getAllByRole("button");

    expect(latestTab.className).toContain("bg-brand");
    expect(mostReadTab.className).not.toContain("bg-brand");

    await act(async () => mostReadTab.click());

    expect(screen.getAllByRole("button")[1].className).toContain("bg-brand");
    expect(screen.getAllByRole("button")[0].className).not.toContain("bg-brand");
  });

  it("wraps each row in its own bordered card rather than a shared divider list", () => {
    const { container } = render(<LatestNewsCard lang="ar" latest={latest} mostRead={mostRead} />);
    const rows = Array.from(container.querySelectorAll("a"));

    expect(rows).toHaveLength(latest.length);
    for (const row of rows) {
      expect(row.className).toContain("border");
      expect(row.className).toContain("rounded-lg");
    }
  });

  it("renders a row's title beside its thumbnail even with no image yet", () => {
    render(<LatestNewsCard lang="ar" latest={latest} mostRead={mostRead} />);

    // l2 has no imageSrc — the row must still render, title and all.
    expect(screen.getByText("خبر جديد ثانٍ")).toBeInTheDocument();
  });

  it("renders nothing when both tabs would be empty", () => {
    const { container } = render(<LatestNewsCard lang="ar" latest={[]} mostRead={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("survives an empty most-read side without losing the tab switch", async () => {
    render(<LatestNewsCard lang="ar" latest={latest} mostRead={[]} />);

    await act(async () => screen.getByRole("button", { name: "الأكثر قراءة" }).click());

    expect(screen.getByRole("button", { name: "الأكثر قراءة" })).toBeInTheDocument();
    expect(screen.queryByText("خبر جديد أول")).not.toBeInTheDocument();
  });

  it("speaks English on the English edition", () => {
    render(<LatestNewsCard lang="en" latest={latest} mostRead={mostRead} />);

    expect(screen.getByRole("button", { name: "Latest News" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Most Read" })).toBeInTheDocument();
  });
});
