import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CoverImage from "./CoverImage";

vi.mock("next/image", () => ({
  default: ({ src, alt, ...rest }: any) => <img src={src} alt={alt} {...rest} />,
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

  it("fades in once the image reports loaded rather than popping in blank", () => {
    render(<CoverImage {...props} src="/media/covers/a.jpg" />);
    const img = screen.getByRole("img");

    expect(img).toHaveClass("opacity-0");

    fireEvent.load(img);

    expect(img).toHaveClass("opacity-100");
    expect(img).not.toHaveClass("opacity-0");
  });
  /**
   * The "3 of 94 broken images" on the homepage: a src that 404s never fires
   * onLoad, so the <Image> stayed at opacity-0 over the wrapper's grey and
   * the card kept a permanently empty box. A dead URL must degrade to the
   * same branded slot a missing URL already got.
   */
  it("falls back to the placeholder when the image fails to load", () => {
    render(<CoverImage {...props} src="/media/covers/gone.jpg" />);

    expect(screen.getByRole("img")).toBeInTheDocument();
    fireEvent.error(screen.getByRole("img"));

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("أفلت صورة الخبر هنا")).toBeInTheDocument();
  });
});
