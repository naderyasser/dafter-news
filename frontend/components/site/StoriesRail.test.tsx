import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import StoriesRail from "./StoriesRail";
import type { Story } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const story = (over: Partial<Story> = {}): Story => ({
  id: 1,
  title: "محور الدلتا.. الصورة الكاملة",
  image: null,
  href: "/section/egypt",
  section: 1,
  section_name: "شؤون مصر",
  active: true,
  order: 1,
  ...over,
});

describe("StoriesRail", () => {
  it("renders one card per story", () => {
    render(<StoriesRail lang="ar" stories={[story(), story({ id: 2, title: "قرار الفائدة" })]} />);

    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getByText("قرار الفائدة")).toBeInTheDocument();
  });

  it("shows the section label on the card", () => {
    render(<StoriesRail lang="ar" stories={[story()]} />);

    expect(screen.getByText("شؤون مصر")).toBeInTheDocument();
  });

  it("renders nothing at all when there are no stories", () => {
    // An empty rail would otherwise leave a stranded heading and padding.
    const { container } = render(<StoriesRail lang="ar" stories={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("scrolls horizontally rather than wrapping", () => {
    const { container } = render(<StoriesRail lang="ar" stories={[story()]} />);

    const track = container.querySelector(".overflow-x-auto");
    expect(track).not.toBeNull();
    expect(track?.className).toContain("snap-x");
  });

  it("uses tall portrait cards", () => {
    const { container } = render(<StoriesRail lang="ar" stories={[story()]} />);

    expect(container.querySelector(".aspect-\\[9\\/16\\]")).not.toBeNull();
  });

  it("falls back to # when a story has no destination", () => {
    render(<StoriesRail lang="ar" stories={[story({ href: "" })]} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "#");
  });

  it("renders the image when one is set", () => {
    // alt="" is deliberate — the card's title carries the meaning, so the
    // image is decorative and stays out of the accessibility tree (which is
    // why this queries the DOM rather than role="img").
    const { container } = render(<StoriesRail lang="ar" stories={[story({ image: "/media/stories/a.jpg" })]} />);

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain("/media/stories/a.jpg");
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("uses the English heading in English", () => {
    render(<StoriesRail lang="en" stories={[story()]} />);

    expect(screen.getByText("Today's stories")).toBeInTheDocument();
  });
});
