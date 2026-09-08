import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ListThumb from "./ListThumb";

vi.mock("next/image", () => ({
  default: ({ src, alt, fill: _fill, ...rest }: any) => <img src={src} alt={alt} {...rest} />,
}));

/**
 * The shared list thumbnail. The contract the client asked for is a single
 * shape everywhere: square, cropped (never distorted), rounded — so the
 * classes ARE the behaviour here.
 */
describe("ListThumb", () => {
  it("is a square, rounded, cropped frame", () => {
    const { container } = render(<ListThumb src="/media/covers/a.jpg" alt="غلاف" />);

    const frame = container.firstElementChild!;
    expect(frame).toHaveClass("aspect-square", "rounded-md", "overflow-hidden");
    expect(screen.getByRole("img").className).toContain("object-cover");
  });

  it("serves a thumbnail-sized file, not the full cover", () => {
    // alt="" is a decorative image, which has no img role — query the tag.
    const { container } = render(<ListThumb src="/media/covers/a.jpg" size="sm" />);

    expect(container.querySelector("img")).toHaveAttribute("sizes", "64px");
  });

  it("falls back to the given image when there is no source", () => {
    const { container } = render(<ListThumb fallbackSrc="/icon.png" fallbackFit="contain" />);

    expect(container.querySelector("img")).toHaveAttribute("src", "/icon.png");
  });

  it("lets the caller lay a chip over the photo", () => {
    render(
      <ListThumb src="/media/covers/a.jpg">
        <span className="absolute start-1 top-1">الكويت</span>
      </ListThumb>,
    );

    expect(screen.getByText("الكويت")).toBeInTheDocument();
  });
});
