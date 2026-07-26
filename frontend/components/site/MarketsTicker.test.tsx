import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MarketsTicker from "./MarketsTicker";
import type { TickerPayload } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const payload: TickerPayload = {
  currencies: [
    { id: 1, flag_emoji: "🇺🇸", code: "USD", buy: "48.70", sell: "48.85", change_pct: "0.30", is_up: true, series: [48.2, 48.85], order: 1 },
    { id: 2, flag_emoji: "🇪🇺", code: "EUR", buy: "51.90", sell: "52.10", change_pct: "-0.15", is_up: false, series: [52.6, 52.1], order: 2 },
  ],
  gold: [{ id: 1, label: "عيار 21", price: "3,550", change_pct: "0.80", is_up: true, order: 1 }],
  weather: { id: 1, key: "cairo", label: "القاهرة", icon: "☀️", temp: 34, hi: 36, lo: 24, humidity: 32, order: 1 },
  cities: [],
  modules: [],
};

describe("MarketsTicker", () => {
  it("renders currency, gold and weather values", () => {
    render(<MarketsTicker lang="ar" data={payload} />);

    expect(screen.getByText("48.85")).toBeInTheDocument();
    expect(screen.getByText("3,550")).toBeInTheDocument();
    expect(screen.getByText("34°")).toBeInTheDocument();
  });

  it("is a single link to the markets page", () => {
    // Brief §6: «الشريط بالكامل رابط واحد لصفحة الأسواق».
    render(<MarketsTicker lang="ar" data={payload} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/markets");
  });

  it("colours a rise with the up token and a fall with the down token", () => {
    // §10.3: never the brand red for a price move, never the down red for brand.
    render(<MarketsTicker lang="ar" data={payload} />);

    const rises = screen.getAllByText(/▲/);
    const falls = screen.getAllByText(/▼/);

    expect(rises).toHaveLength(2); // USD and gold both rose
    expect(falls).toHaveLength(1); // EUR fell
    for (const rise of rises) {
      expect(rise.className).toContain("text-up");
      expect(rise.className).not.toContain("text-brand");
    }
    expect(falls[0].className).toContain("text-down");
  });

  it("gives every figure tabular numerals", () => {
    render(<MarketsTicker lang="ar" data={payload} />);

    expect(screen.getByText("48.85").className).toContain("tnum");
    expect(screen.getByText("34°").className).toContain("tnum");
  });

  it("uses Arabic currency labels in Arabic", () => {
    render(<MarketsTicker lang="ar" data={payload} />);

    expect(screen.getByText("دولار/جنيه")).toBeInTheDocument();
  });

  it("uses code-based labels in English", () => {
    render(<MarketsTicker lang="en" data={payload} />);

    expect(screen.getByText("USD/EGP")).toBeInTheDocument();
  });

  it("reserves the sticky 52px strip at the bottom", () => {
    // §5: every public page reserves 52px for this bar.
    const { container } = render(<MarketsTicker lang="ar" data={payload} />);

    const bar = container.firstElementChild as HTMLElement;
    expect(bar.className).toContain("fixed");
    expect(bar.className).toContain("bottom-0");
    expect(bar.className).toContain("h-[52px]");
  });

  it("renders without crashing when the payload is empty", () => {
    render(<MarketsTicker lang="ar" data={{ currencies: [], gold: [], weather: null, cities: [], modules: [] }} />);

    expect(screen.getByRole("link")).toBeInTheDocument();
  });

  it("omits the weather block when weather is unavailable", () => {
    render(<MarketsTicker lang="ar" data={{ ...payload, weather: null }} />);

    expect(screen.queryByText("34°")).not.toBeInTheDocument();
    expect(screen.getByText("48.85")).toBeInTheDocument();
  });
});
