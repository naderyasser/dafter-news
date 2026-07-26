import { render, screen, within } from "@testing-library/react";
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

const empty: TickerPayload = { currencies: [], gold: [], weather: null, cities: [], modules: [] };

/**
 * The tape renders the row twice so the 50% translate loops seamlessly; the
 * duplicate is aria-hidden. Scope assertions to the visible copy so a count
 * doesn't silently double.
 */
const visibleStrip = (container: HTMLElement) =>
  within(container.querySelector('[aria-hidden="false"]') as HTMLElement);

describe("MarketsTicker", () => {
  it("renders currency, gold and weather values", () => {
    const { container } = render(<MarketsTicker lang="ar" data={payload} />);
    const strip = visibleStrip(container);

    expect(strip.getByText("48.85")).toBeInTheDocument();
    expect(strip.getByText("3,550")).toBeInTheDocument();
    expect(strip.getByText("34°")).toBeInTheDocument();
  });

  it("is a single link to the markets page", () => {
    // Brief §6: «الشريط بالكامل رابط واحد لصفحة الأسواق».
    render(<MarketsTicker lang="ar" data={payload} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/markets");
  });

  it("duplicates the row so the loop has no visible seam", () => {
    const { container } = render(<MarketsTicker lang="ar" data={payload} />);

    expect(container.querySelector('[aria-hidden="false"]')).not.toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("hides the duplicate copy from assistive tech", () => {
    // Otherwise every rate would be announced twice.
    const { container } = render(<MarketsTicker lang="ar" data={payload} />);

    const dupe = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(within(dupe).getByText("48.85")).toBeInTheDocument();
  });

  it("scrolls continuously rather than sitting still", () => {
    const { container } = render(<MarketsTicker lang="ar" data={payload} />);

    const track = container.querySelector(".animate-ticker-rtl");
    expect(track).not.toBeNull();
  });

  it("travels the other way in LTR", () => {
    const { container } = render(<MarketsTicker lang="en" data={payload} />);

    expect(container.querySelector(".animate-ticker-ltr")).not.toBeNull();
    expect(container.querySelector(".animate-ticker-rtl")).toBeNull();
  });

  it("pauses on hover so a number can actually be read", () => {
    const { container } = render(<MarketsTicker lang="ar" data={payload} />);

    const track = container.querySelector(".animate-ticker-rtl");
    expect(track?.className).toContain("hover:[animation-play-state:paused]");
  });

  it("stops moving under prefers-reduced-motion", () => {
    const { container } = render(<MarketsTicker lang="ar" data={payload} />);

    expect(container.querySelector(".animate-ticker-rtl")?.className).toContain("motion-reduce:animate-none");
  });

  it("colours a rise with the up token and a fall with the down token", () => {
    // §10.3: never the brand red for a price move, never the down red for brand.
    const { container } = render(<MarketsTicker lang="ar" data={payload} />);
    const strip = visibleStrip(container);

    const rises = strip.getAllByText(/▲/);
    const falls = strip.getAllByText(/▼/);

    expect(rises).toHaveLength(2); // USD and gold both rose
    expect(falls).toHaveLength(1); // EUR fell
    for (const rise of rises) {
      expect(rise.className).toContain("text-up");
      expect(rise.className).not.toContain("text-brand");
    }
    expect(falls[0].className).toContain("text-down");
  });

  it("gives every figure tabular numerals", () => {
    const { container } = render(<MarketsTicker lang="ar" data={payload} />);
    const strip = visibleStrip(container);

    expect(strip.getByText("48.85").className).toContain("tnum");
    expect(strip.getByText("34°").className).toContain("tnum");
  });

  it("shows every currency, not just the first two", () => {
    // The tape scrolls, so there's no reason to truncate the list any more.
    const { container } = render(<MarketsTicker lang="ar" data={payload} />);
    const strip = visibleStrip(container);

    expect(strip.getByText("48.85")).toBeInTheDocument();
    expect(strip.getByText("52.10")).toBeInTheDocument();
  });

  it("uses Arabic currency labels in Arabic", () => {
    const { container } = render(<MarketsTicker lang="ar" data={payload} />);

    expect(visibleStrip(container).getByText("دولار/جنيه")).toBeInTheDocument();
  });

  it("uses code-based labels in English", () => {
    const { container } = render(<MarketsTicker lang="en" data={payload} />);

    expect(visibleStrip(container).getByText("USD/EGP")).toBeInTheDocument();
  });

  it("reserves the sticky 52px strip at the bottom", () => {
    // §5: every public page reserves 52px for this bar.
    const { container } = render(<MarketsTicker lang="ar" data={payload} />);

    const bar = container.firstElementChild as HTMLElement;
    expect(bar.className).toContain("fixed");
    expect(bar.className).toContain("bottom-0");
    expect(bar.className).toContain("h-[52px]");
  });

  it("renders the bar without crashing when the payload is empty", () => {
    const { container } = render(<MarketsTicker lang="ar" data={empty} />);

    expect(screen.getByRole("link")).toBeInTheDocument();
    expect(container.querySelector(".animate-ticker-rtl")).toBeNull();
  });

  it("omits the weather block when weather is unavailable", () => {
    const { container } = render(<MarketsTicker lang="ar" data={{ ...payload, weather: null }} />);
    const strip = visibleStrip(container);

    expect(strip.queryByText("34°")).not.toBeInTheDocument();
    expect(strip.getByText("48.85")).toBeInTheDocument();
  });
});
