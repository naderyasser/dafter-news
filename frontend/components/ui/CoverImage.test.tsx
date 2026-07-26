import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CoverImage from "./CoverImage";

vi.mock("next/image", () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));

const props = { alt: "غلاف", placeholder: "أفلت صورة الخبر هنا" };

describe("CoverImage", () => {
  it("positions itself when the caller passes no position class", () => {
    const { container } = render(<CoverImage {...props} src="/media/covers/a.jpg" />);

    expect(container.firstElementChild).toHaveClass("relative");
  });

  // Regression: the wrapper used to hardcode `relative` alongside the caller's
  // `absolute inset-0`. Tailwind emits `.relative` after `.absolute`, so the
  // wrapper collapsed to zero height and every card cover rendered blank.
  it("does not emit `relative` when the caller already positions it", () => {
    const { container } = render(
      <CoverImage {...props} src="/media/covers/a.jpg" className="absolute inset-0" />,
    );
    const wrapper = container.firstElementChild!;

    expect(wrapper).toHaveClass("absolute", "inset-0");
    expect(wrapper).not.toHaveClass("relative");
    expect(screen.getByRole("img")).toHaveAttribute("src", "/media/covers/a.jpg");
  });

  it("still renders the placeholder when there is no source", () => {
    render(<CoverImage {...props} className="absolute inset-0" />);

    expect(screen.getByText("أفلت صورة الخبر هنا")).toBeInTheDocument();
  });
});
