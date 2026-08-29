import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SportsBlock from "./SportsBlock";
import type { Match } from "@/lib/types";

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

const cards = Array.from({ length: 5 }, (_, i) => ({
  href: `/article/s${i}`,
  title: `خبر رياضي ${i}`,
  section: "جوّه الجون",
  time: `منذ ${i + 1} ساعات`,
  imageSrc: null,
}));

const match = (over: Partial<Match> = {}): Match =>
  ({
    id: 1,
    league: "الدوري المصري الممتاز",
    home_team: "Al Ahly",
    away_team: "Zamalek",
    home_score: 2,
    away_score: 1,
    status: "finished",
    kickoff_at: "2026-08-17T18:00:00Z",
    round_label: "الجولة 5",
    venue: "",
    score_label: "2 - 1",
    ...over,
  }) as Match;

describe("SportsBlock", () => {
  it("plays the newest story as the lead and numbers the rest from two", () => {
    // The list arrives newest-first, so the lead IS the newest — and the
    // running order tells a reader the rest are ranked, not scattered.
    render(<SportsBlock lang="ar" title="جوّه الجون" href="/section/sports" cards={cards} />);

    expect(screen.getByRole("heading", { level: 3, name: "خبر رياضي 0" })).toBeInTheDocument();
    const list = screen.getByRole("list");
    expect(within(list).getByText("2")).toBeInTheDocument();
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
  });

  it("renders nothing at all when the desk has no stories", () => {
    const { container } = render(<SportsBlock lang="ar" title="جوّه الجون" href="/section/sports" cards={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("puts the scoreboard in the band, with both teams and the score", () => {
    render(<SportsBlock lang="ar" title="جوّه الجون" href="/section/sports" cards={cards} matches={[match()]} />);

    // Scoped to the board: "2" is also a running-order number in the story
    // list, and an unscoped query would match whichever came first.
    const board = screen.getByText("لوحة النتائج").closest("div")!.parentElement!;
    expect(within(board).getByText("الأهلي")).toBeInTheDocument();
    expect(within(board).getByText("الزمالك")).toBeInTheDocument();
    expect(within(board).getByText("2")).toBeInTheDocument();
    expect(within(board).getByText("1")).toBeInTheDocument();
  });

  it("marks a live match with the badge colour urgency is reserved for", () => {
    render(<SportsBlock lang="ar" title="جوّه الجون" href="/section/sports" cards={cards} matches={[match({ status: "live" })]} />);

    const live = screen.getByText("مباشر");
    expect(live.closest("span")!.className).toContain("bg-badge-live");
  });

  it("shows a dash rather than 0-0 for a match that hasn't kicked off", () => {
    // Zeros read as a goalless draw; a dash reads as "not played".
    render(
      <SportsBlock
        lang="ar"
        title="جوّه الجون"
        href="/section/sports"
        cards={cards}
        matches={[match({ status: "scheduled", home_score: null, away_score: null })]}
      />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("gives the stories the full width when there are no fixtures", () => {
    const { container } = render(<SportsBlock lang="ar" title="جوّه الجون" href="/section/sports" cards={cards} />);

    expect(screen.queryByText("لوحة النتائج")).not.toBeInTheDocument();
    expect(container.querySelector(".lg\\:grid-cols-\\[1\\.7fr_1fr\\]")).toBeNull();
  });

  it("paints its own pitch surface rather than the page's paper", () => {
    // The client asked for this desk to stand out; the surface is how.
    const { container } = render(<SportsBlock lang="ar" title="جوّه الجون" href="/section/sports" cards={cards} />);

    expect(container.querySelector(".pitch-surface")).not.toBeNull();
    expect(container.querySelector(".pitch-markings")).not.toBeNull();
  });

  it("translates its chrome for the English edition", () => {
    render(<SportsBlock lang="en" title="Sports" href="/en/section/sports" cards={cards} matches={[match()]} />);

    expect(screen.getByText("Scoreboard")).toBeInTheDocument();
    expect(screen.getByText("All stories")).toBeInTheDocument();
    // TheSportsDB's own strings are already English — only chrome is mapped.
    expect(screen.getByText("Al Ahly")).toBeInTheDocument();
  });
});
