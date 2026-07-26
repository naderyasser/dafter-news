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
});
