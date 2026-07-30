import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SpecialShowcase from "./SpecialShowcase";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, ...rest }: any) => <img src={typeof src === "string" ? src : ""} alt={alt} {...rest} />,
}));

const items = [
  { href: "/article/f1", title: "ملف: أمن المياه", imageSrc: "/m/1.jpg", authorName: "محمد العدوي", authorAvatar: null, authorInitial: "م" },
  { href: "/article/f2", title: "ملف: الاقتصاد غير الرسمي", imageSrc: "/m/2.jpg", authorName: "محمد العدوي", authorAvatar: null, authorInitial: "م" },
  { href: "/article/f3", title: "ملف: الدلتا الجديدة", imageSrc: "/m/3.jpg", authorName: "محمد العدوي", authorAvatar: null, authorInitial: "م" },
];

/**
 * The cinema stage — the client's «حالياً في دور العرض» reference for
 * «ملف خاص»: one staged poster that is a link, wings that are buttons,
 * and a red dot-strip that counts the shelf.
 */
describe("SpecialShowcase", () => {
  it("renders nothing rather than an empty stage", () => {
    const { container } = render(<SpecialShowcase lang="ar" items={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("stages the first file as a link and its wings as buttons", () => {
    render(<SpecialShowcase lang="ar" items={items} />);

    expect(screen.getByText("ملف: أمن المياه").closest("a")).toHaveAttribute("href", "/article/f1");
    expect(screen.getByText("ملف: الاقتصاد غير الرسمي").closest("button")).not.toBeNull();
    expect(screen.getByText("ملف: الدلتا الجديدة").closest("button")).not.toBeNull();
  });

  it("advances the stage with the arrow", () => {
    render(<SpecialShowcase lang="ar" items={items} />);

    fireEvent.click(screen.getByLabelText("الملف التالي"));

    expect(screen.getByText("ملف: الاقتصاد غير الرسمي").closest("a")).toHaveAttribute("href", "/article/f2");
    expect(screen.getByText("ملف: أمن المياه").closest("button")).not.toBeNull();
  });

  it("brings a wing to the stage when clicked", () => {
    render(<SpecialShowcase lang="ar" items={items} />);

    fireEvent.click(screen.getByText("ملف: الدلتا الجديدة").closest("button")!);

    expect(screen.getByText("ملف: الدلتا الجديدة").closest("a")).toHaveAttribute("href", "/article/f3");
  });

  it("counts the shelf with one dot per file, jumping on click", () => {
    render(<SpecialShowcase lang="ar" items={items} />);

    const dots = [1, 2, 3].map((i) => screen.getByLabelText(`الملف ${i}`));
    expect(dots[0]).toHaveAttribute("aria-current", "true");

    fireEvent.click(dots[2]);
    expect(dots[2]).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("ملف: الدلتا الجديدة").closest("a")).not.toBeNull();
  });

  it("signs only the staged poster with its journalist", () => {
    render(<SpecialShowcase lang="ar" items={items} />);

    // One byline visible at a time — the wings stay quiet.
    expect(screen.getAllByText("محمد العدوي")).toHaveLength(1);
  });

  it("wraps around at the end of the shelf", () => {
    render(<SpecialShowcase lang="ar" items={items} />);

    const next = screen.getByLabelText("الملف التالي");
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);

    expect(screen.getByText("ملف: أمن المياه").closest("a")).toHaveAttribute("href", "/article/f1");
  });

  it("hides arrows and dots for a single file", () => {
    render(<SpecialShowcase lang="ar" items={[items[0]]} />);

    expect(screen.queryByLabelText("الملف التالي")).not.toBeInTheDocument();
    expect(screen.getByText("ملف: أمن المياه").closest("a")).not.toBeNull();
  });
});
