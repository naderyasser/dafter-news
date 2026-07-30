import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ArticleCard from "./ArticleCard";

// next/link and next/image need stubbing outside a Next runtime.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));

const base = { lang: "ar" as const, href: "/article/x", title: "عنوان الخبر" };

describe("ArticleCard", () => {
  it("renders a standard card with section and time", () => {
    render(<ArticleCard {...base} variant="standard" section="مصر" time="منذ ساعة" />);

    expect(screen.getByText("عنوان الخبر")).toBeInTheDocument();
    expect(screen.getByText("مصر")).toBeInTheDocument();
    expect(screen.getByText("منذ ساعة")).toBeInTheDocument();
  });

  it("links to the given href", () => {
    render(<ArticleCard {...base} variant="standard" />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/article/x");
  });

  it("shows a placeholder instead of a broken image when there is no cover", () => {
    render(<ArticleCard {...base} variant="standard" />);

    expect(screen.getByText("أفلت صورة الخبر هنا")).toBeInTheDocument();
  });

  it("renders the cover image when one is supplied", () => {
    render(<ArticleCard {...base} variant="standard" imageSrc="http://x/a.jpg" />);

    expect(screen.getByRole("img")).toHaveAttribute("src", "http://x/a.jpg");
  });

  describe("badges", () => {
    it("renders no badge by default", () => {
      render(<ArticleCard {...base} variant="standard" />);

      expect(screen.queryByText("عاجل")).not.toBeInTheDocument();
      expect(screen.queryByText("خاص")).not.toBeInTheDocument();
    });

    it("renders the breaking badge", () => {
      render(<ArticleCard {...base} variant="standard" badge="breaking" />);

      expect(screen.getByText("عاجل")).toBeInTheDocument();
    });

    it("renders the exclusive badge in gold, not brand red", () => {
      // Brief §2: خاص is --badge-exclusive (gold), distinct from the brand.
      render(<ArticleCard {...base} variant="standard" badge="exclusive" />);

      expect(screen.getByText("خاص").className).toContain("bg-gold");
    });

    it("gives the live badge a pulsing dot", () => {
      const { container } = render(<ArticleCard {...base} variant="standard" badge="live" />);

      expect(screen.getByText("مباشر")).toBeInTheDocument();
      expect(container.querySelector(".animate-pulse-dot")).not.toBeNull();
    });

    it("positions the badge at the inline start, not a physical side", () => {
      // Brief §4 forbids left/right; the badge must flip with direction.
      render(<ArticleCard {...base} variant="standard" badge="breaking" />);

      const badge = screen.getByText("عاجل");
      expect(badge.className).toContain("start-2");
      expect(badge.className).not.toMatch(/\bleft-|\bright-/);
    });
  });

  describe("video affordances", () => {
    it("shows duration and comment count", () => {
      render(<ArticleCard {...base} variant="standard" isVideo videoDuration="04:12" comments={86} />);

      expect(screen.getByText("04:12")).toBeInTheDocument();
      expect(screen.getByText(/86/)).toBeInTheDocument();
    });

    it("gives the duration tabular figures", () => {
      render(<ArticleCard {...base} variant="standard" isVideo videoDuration="04:12" />);

      expect(screen.getByText("04:12").className).toContain("tnum");
    });

    it("mirrors the play glyph in RTL", () => {
      // Brief §4: the ▶ icon flips in RTL via scaleX(-1).
      render(<ArticleCard {...base} lang="ar" variant="standard" isVideo videoDuration="01:00" />);

      expect(screen.getByText("▶").className).toContain("-scale-x-100");
    });

    it("does not mirror the play glyph in LTR", () => {
      render(<ArticleCard {...base} lang="en" variant="standard" isVideo videoDuration="01:00" />);

      expect(screen.getByText("▶").className).not.toContain("-scale-x-100");
    });

    it("shows no video chrome for a normal article", () => {
      render(<ArticleCard {...base} variant="standard" />);

      expect(screen.queryByText("▶")).not.toBeInTheDocument();
    });
  });

  describe("variants", () => {
    it("renders the hero variant with a white overlaid title", () => {
      const { container } = render(<ArticleCard {...base} variant="hero" section="رياضة" />);

      expect(screen.getByText("عنوان الخبر").className).toContain("text-paper");
      expect(container.querySelector(".aspect-\\[16\\/10\\]")).not.toBeNull();
    });

    it("renders the compact variant with a 120px side image", () => {
      const { container } = render(<ArticleCard {...base} variant="compact" time="منذ ساعتين" />);

      expect(container.querySelector(".w-\\[120px\\]")).not.toBeNull();
      expect(screen.getByText("منذ ساعتين")).toBeInTheDocument();
    });

    it("renders the text variant with an excerpt and no image", () => {
      render(<ArticleCard {...base} variant="text" excerpt="سطر توضيحي قصير" time="منذ 4 ساعات" />);

      expect(screen.getByText("سطر توضيحي قصير")).toBeInTheDocument();
      expect(screen.queryByText("أفلت صورة الخبر هنا")).not.toBeInTheDocument();
    });

    it("omits the excerpt line when none is given", () => {
      const { container } = render(<ArticleCard {...base} variant="text" />);

      expect(container.textContent).toBe("عنوان الخبر");
    });
  });

  describe("language", () => {
    it("uses the Arabic display face for Arabic", () => {
      render(<ArticleCard {...base} lang="ar" variant="standard" />);

      expect(screen.getByText("عنوان الخبر").className).toContain("font-display-ar");
    });

    it("uses Inter for English", () => {
      render(<ArticleCard {...base} lang="en" variant="standard" title="Headline" />);

      expect(screen.getByText("Headline").className).toContain("font-display-en");
    });

    it("uses English badge copy in English", () => {
      render(<ArticleCard {...base} lang="en" variant="standard" title="Headline" badge="breaking" />);

      expect(screen.getByText("Breaking")).toBeInTheDocument();
    });
  });

  /**
   * The client's country badge: الكويت on a gulf card's photo, and only
   * where a caller passes it — every other section's grid stays clean.
   */
  describe("country chip", () => {
    it("rides the photo's bottom-start corner on the standard card", () => {
      render(<ArticleCard {...base} variant="standard" chip="الكويت" />);

      const chip = screen.getByText("الكويت");
      expect(chip.className).toContain("bottom-0");
      expect(chip.className).toContain("start-0");
      expect(chip.className).not.toMatch(/\bleft-|\bright-/);
    });

    it("takes the section colour when an accent is given", () => {
      render(<ArticleCard {...base} variant="standard" chip="قطر" accent="#0A7B58" />);

      expect(screen.getByText("قطر")).toHaveStyle({ backgroundColor: "#0A7B58" });
    });

    it("shows on the compact thumbnail too", () => {
      render(<ArticleCard {...base} variant="compact" chip="الجزائر" />);

      expect(screen.getByText("الجزائر")).toBeInTheDocument();
    });

    it("stays clear of the corner the breaking badge owns", () => {
      render(<ArticleCard {...base} variant="standard" chip="الكويت" badge="breaking" />);

      expect(screen.getByText("عاجل").className).toContain("top-2");
      expect(screen.getByText("الكويت").className).toContain("bottom-0");
    });

    it("renders no chip element when none is passed", () => {
      const { container } = render(<ArticleCard {...base} variant="standard" />);

      expect(container.querySelector(".bottom-0.start-0")).toBeNull();
    });
  });

  /**
   * Every headline on the site that isn't «عرب وعالم» comes through this
   * component, so if the title is a <div> then a homepage of forty stories
   * exposes not one article headline to heading navigation — which is how
   * most screen-reader users move through a news page. WorldNewsBlock already
   * emitted <h3>; the same content must not be a heading in one block and
   * anonymous text in every other.
   */
  describe("headline semantics", () => {
    it.each(["standard", "compact", "text", "hero"] as const)("renders the %s headline as a heading", (variant) => {
      render(<ArticleCard {...base} lang="ar" variant={variant} />);

      expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("عنوان الخبر");
    });

    it("keeps the headline inside the link, so the whole card stays one target", () => {
      render(<ArticleCard {...base} lang="ar" variant="standard" />);

      expect(screen.getByRole("link").querySelector("h3")).toHaveTextContent("عنوان الخبر");
    });
  });
});
