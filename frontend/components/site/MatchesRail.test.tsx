import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MatchesRail from "./MatchesRail";
import type { Match } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const match = (over: Partial<Match> = {}): Match => ({
  id: 1,
  league: "الدوري المصري الممتاز",
  home_team: "الأهلي",
  away_team: "الزمالك",
  home_score: 2,
  away_score: 1,
  score_label: "2 - 1",
  status: "finished",
  kickoff_at: "2026-07-20T19:00:00Z",
  round_label: "الجولة 3",
  venue: "استاد القاهرة",
  ...over,
});

describe("MatchesRail", () => {
  it("renders teams and the score", () => {
    render(<MatchesRail matches={[match()]} />);

    expect(screen.getByText("الأهلي")).toBeInTheDocument();
    expect(screen.getByText("الزمالك")).toBeInTheDocument();
    expect(screen.getByText("2 - 1")).toBeInTheDocument();
  });

  it("renders nothing when there are no matches", () => {
    const { container } = render(<MatchesRail matches={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows a dash for an unplayed fixture instead of zeros", () => {
    // 0-0 on an unplayed match reads as a goalless draw.
    render(
      <MatchesRail
        matches={[match({ id: 2, status: "scheduled", home_score: null, away_score: null, score_label: "—" })]}
      />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("puts results before fixtures", () => {
    const { container } = render(
      <MatchesRail
        matches={[
          match({ id: 2, status: "scheduled", home_team: "بيراميدز", score_label: "—" }),
          match({ id: 1, status: "finished", home_team: "الأهلي" }),
        ]}
      />,
    );

    const text = container.textContent || "";
    expect(text.indexOf("الأهلي")).toBeLessThan(text.indexOf("بيراميدز"));
  });

  it("labels a finished match as ended", () => {
    render(<MatchesRail matches={[match()]} />);

    expect(screen.getByText("انتهت")).toBeInTheDocument();
  });

  it("gives a live match a pulsing badge rather than a static label", () => {
    const { container } = render(<MatchesRail matches={[match({ status: "live" })]} />);

    expect(screen.getByText("مباشر")).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse-dot")).not.toBeNull();
    expect(screen.queryByText("انتهت")).not.toBeInTheDocument();
  });

  it("shows the kickoff time for a fixture and the venue for a result", () => {
    const { unmount } = render(<MatchesRail matches={[match()]} />);
    expect(screen.getByText("استاد القاهرة")).toBeInTheDocument();
    unmount();

    render(<MatchesRail matches={[match({ status: "scheduled", score_label: "—" })]} />);
    expect(screen.queryByText("استاد القاهرة")).not.toBeInTheDocument();
  });

  it("gives the score tabular figures", () => {
    render(<MatchesRail matches={[match()]} />);

    expect(screen.getByText("2 - 1").className).toContain("tnum");
  });

  it("caps the rail at six matches", () => {
    const many = Array.from({ length: 12 }, (_, i) => match({ id: i, home_team: `فريق ${i}` }));

    render(<MatchesRail matches={many} />);

    expect(screen.getAllByText("2 - 1")).toHaveLength(6);
  });

  it("falls back to the league name when a match has no round label", () => {
    render(<MatchesRail matches={[match({ round_label: "" })]} />);

    expect(screen.getByText("الدوري المصري الممتاز")).toBeInTheDocument();
  });
});
