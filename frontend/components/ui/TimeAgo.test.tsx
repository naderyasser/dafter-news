import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TimeAgo from "./TimeAgo";

/**
 * The homepage carried no <time> element anywhere before this — every card
 * printed either a bare string or nothing at all, which is what made the
 * page read as undated. These lock in the two halves that matter: the
 * machine-readable instant, and the refusal to render an empty stamp.
 */
describe("TimeAgo", () => {
  it("carries the raw instant in a datetime attribute", () => {
    const iso = new Date(Date.now() - 3 * 3600_000).toISOString();
    const { container } = render(<TimeAgo iso={iso} lang="ar" />);

    const el = container.querySelector("time");
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute("dateTime", iso);
  });

  it("renders the Arabic relative phrase readers actually see", () => {
    const iso = new Date(Date.now() - 3 * 3600_000).toISOString();
    render(<TimeAgo iso={iso} lang="ar" />);

    expect(screen.getByText(/منذ ٣ ساعات|منذ 3 ساعات/)).toBeInTheDocument();
  });

  it("renders nothing at all when the story has no published instant", () => {
    // An empty <time> is worse than an absent one for a crawler and for a
    // screen reader, so the component opts out entirely.
    const { container } = render(<TimeAgo iso={null} lang="ar" />);

    expect(container.querySelector("time")).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });
});
