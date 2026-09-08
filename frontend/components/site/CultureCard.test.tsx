import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CultureCard from "./CultureCard";

vi.mock("next/image", () => ({
  default: ({ src, alt, fill: _fill, ...rest }: any) => <img src={src} alt={alt} {...rest} />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const base = {
  lang: "ar" as const,
  href: "/article/interview",
  title: "بهاء سلطان: الأغنية الشعبية رجعت",
  imageSrc: "/media/covers/bahaa.jpg",
  accent: "#7A3E9D",
};

describe("CultureCard", () => {
  it("is one link carrying the headline over a portrait photo", () => {
    const { container } = render(<CultureCard {...base} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/article/interview");
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("بهاء سلطان");
    expect(container.querySelector(".aspect-\\[4\\/5\\]")).not.toBeNull();
    expect(container.querySelector(".rounded-2xl")).not.toBeNull();
  });

  it("shows the byline as a badge on the photo, with the portrait when there is one", () => {
    const { container } = render(<CultureCard {...base} authorName="ندى محمود" authorAvatar="/media/avatars/nada.jpg" />);

    expect(screen.getByText("ندى محمود")).toBeInTheDocument();
    expect(container.querySelector('img[src="/media/avatars/nada.jpg"]')).not.toBeNull();
  });

  it("falls back to the initial when the byline has no photo", () => {
    render(<CultureCard {...base} authorName="ندى محمود" authorInitial="ن" />);

    expect(screen.getByText("ن")).toBeInTheDocument();
  });

  it("paints the corner tag in the desk's colour", () => {
    render(<CultureCard {...base} chip="لقاء" />);

    expect(screen.getByText("لقاء")).toHaveStyle({ backgroundColor: "#7A3E9D" });
  });

  it("shows the site's mark rather than a grey hole with no cover", () => {
    const { container } = render(<CultureCard {...base} imageSrc={null} />);

    expect(container.querySelector('img[src="/icon.png"]')).not.toBeNull();
  });
});
