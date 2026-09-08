import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import NewsGridFront, { GRID_COUNT, NewsGridBody } from "./NewsGridFront";
import type { FrontStory } from "./types";

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

const story = (id: number, over: Partial<FrontStory> = {}): FrontStory => ({
  id,
  href: `/article/a${id}`,
  title: `خبر ${id}`,
  standfirst: id === 1 ? "مقدمة الخبر الأول" : undefined,
  imageSrc: `/media/c${id}.jpg`,
  time: "",
  badge: "none",
  views: 0,
  ...over,
});

const stories = (n: number) => Array.from({ length: n }, (_, i) => story(i + 1));

const base = { lang: "ar" as const, accent: "#7A1E2B", sectionKey: "pol", title: "سياسة", tagline: "قراءة في القرار والموقف" };

/**
 * The client's 2026-09-09 note on the section pages: «تنسيق عشوائي وتداخل في
 * العناصر، مع وجود تظليل/صور داكنة» — and the ask: an organised responsive
 * grid, no dark overlays, the same card everywhere, newest first. These pin
 * each of those down.
 */
describe("NewsGridFront", () => {
  it("prints the masthead in ink on paper — no coloured band, no darkening gradient", () => {
    const { container } = render(<NewsGridFront {...base} stories={stories(3)} />);

    const h1 = screen.getByRole("heading", { level: 1, name: "سياسة" });
    expect(h1).toHaveClass("text-ink");
    expect(screen.getByText("قراءة في القرار والموقف")).toBeInTheDocument();
    expect(container.querySelector('[class*="gradient"]')).toBeNull();
    expect(container.querySelector('[class*="mix-blend"]')).toBeNull();
  });

  it("sets the lead headline beside its photo in plain ink — never white text over a scrim", () => {
    const { container } = render(<NewsGridFront {...base} stories={stories(3)} />);

    const lead = container.querySelector("[data-front-lead]")!;
    const h2 = lead.querySelector("h2")!;
    expect(h2).toHaveTextContent("خبر 1");
    expect(h2).toHaveClass("text-ink");
    expect(h2).not.toHaveClass("text-paper");
    expect(lead.querySelector('[class*="gradient"]')).toBeNull();
    expect(lead.querySelector('[class*="absolute inset-x-0 bottom-0"]')).toBeNull();
    expect(screen.getByText("مقدمة الخبر الأول")).toBeInTheDocument();
  });

  it("keeps the API's order — the lead is the first story handed in, the grid and rows follow it in sequence", () => {
    render(<NewsGridFront {...base} stories={stories(12)} />);

    const titles = screen.getAllByRole("heading", { level: 2 }).concat(screen.getAllByRole("heading", { level: 3 }));
    const seen = titles.map((h) => h.textContent).filter((t) => t?.startsWith("خبر"));
    expect(seen).toEqual(Array.from({ length: 12 }, (_, i) => `خبر ${i + 1}`));
  });

  it(`lays the next ${GRID_COUNT} out as photo cards in a responsive grid, and the rest as the site's thumbnail rows`, () => {
    const { container } = render(<NewsGridFront {...base} stories={stories(12)} />);

    const grid = container.querySelector("[data-front-grid]")!;
    expect(grid.className).toContain("sm:grid-cols-2");
    expect(grid.className).toContain("lg:grid-cols-3");
    expect(grid.querySelectorAll("a")).toHaveLength(GRID_COUNT);
    // Every grid card is the standard card: photo on top, headline under it.
    for (const card of Array.from(grid.querySelectorAll("a"))) {
      expect(card.querySelector(".aspect-video")).not.toBeNull();
      expect(card.querySelector("h3")).toHaveClass("text-ink");
    }

    const rows = container.querySelector("[data-front-rows]")!;
    expect(screen.getByRole("heading", { level: 2, name: "المزيد من الأخبار" })).toBeInTheDocument();
    expect(rows.querySelectorAll("a")).toHaveLength(12 - 1 - GRID_COUNT);
    // Every row is the compact card: the one square thumbnail at the row's end.
    for (const row of Array.from(rows.querySelectorAll("a"))) {
      expect(row.querySelector(".aspect-square")).not.toBeNull();
    }
  });

  it("holds the rows back while the desk fits in the lead and the grid", () => {
    const { container } = render(<NewsGridFront {...base} stories={stories(1 + GRID_COUNT)} />);

    expect(container.querySelector("[data-front-rows]")).toBeNull();
    expect(screen.queryByText("المزيد من الأخبار")).not.toBeInTheDocument();
  });

  it("uses the story's subject, else its country, as the kicker on a card", () => {
    render(<NewsGridFront {...base} stories={[story(1, { country: "السعودية" }), story(2, { subject: "حرب إيران", country: "إيران" }), story(3, { country: "الكويت" })]} />);

    expect(screen.getByText("السعودية")).toBeInTheDocument();
    expect(screen.getByText("حرب إيران")).toBeInTheDocument();
    expect(screen.queryByText("إيران")).not.toBeInTheDocument();
    expect(screen.getByText("الكويت")).toBeInTheDocument();
  });

  it("renders the phone-side slot between the grid and the rows, hidden from lg up", () => {
    const { container } = render(<NewsGridFront {...base} stories={stories(12)} between={<div data-rail />} />);

    const slot = container.querySelector("[data-rail]")!.parentElement!;
    expect(slot.className).toContain("lg:hidden");
    const order = Array.from(container.querySelectorAll("[data-front-grid], [data-rail], [data-front-rows]")).map((el) => el.getAttribute("data-front-grid") !== null ? "grid" : el.getAttribute("data-rail") !== null ? "rail" : "rows");
    expect(order).toEqual(["grid", "rail", "rows"]);
  });

  it("says so, plainly, when the desk has nothing yet", () => {
    render(<NewsGridFront {...base} stories={[]} />);

    expect(screen.getByText("لا أخبار على هذا المكتب بعد.")).toBeInTheDocument();
  });

  it("carries a story's badge onto its card", () => {
    render(<NewsGridFront {...base} stories={[story(1), story(2, { badge: "breaking" })]} />);

    expect(screen.getByText("عاجل")).toBeInTheDocument();
  });

  it("exports the body on its own for the fronts that keep a data masthead", () => {
    const { container } = render(<NewsGridBody lang="ar" accent="#12793F" stories={stories(3)} />);

    expect(container.querySelector("h1")).toBeNull();
    expect(container.querySelector("[data-front-lead]")).not.toBeNull();
  });

  it("reads the same in English", () => {
    render(<NewsGridFront {...base} lang="en" title="Politics" tagline="The decisions." stories={stories(12)} />);

    expect(screen.getByRole("heading", { level: 1, name: "Politics" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "More stories" })).toBeInTheDocument();
  });
});
