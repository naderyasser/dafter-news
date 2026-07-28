import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ArticleBlocks from "./ArticleBlocks";
import type { ArticleBlock } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

let id = 0;
const block = (over: Partial<ArticleBlock> = {}): ArticleBlock =>
  ({
    id: ++id,
    order: 0,
    type: "paragraph",
    text: "",
    image: null,
    caption: "",
    credit: "",
    related_article: null,
    related_article_slug: null,
    ...over,
  }) as ArticleBlock;

const sentence = (n: number) => `هذه الجملة رقم ${n} وفيها عدد من الكلمات المتوسطة الطول لاختبار التقسيم.`;
const para = (n: number) => Array.from({ length: n }, (_, i) => sentence(i + 1)).join(" ");

describe("ArticleBlocks", () => {
  it("renders a short article as one page with no pager", () => {
    render(<ArticleBlocks lang="ar" blocks={[block({ text: sentence(1) })]} />);

    expect(screen.queryByLabelText("صفحات المقال")).not.toBeInTheDocument();
  });

  it("breaks a wall of text into several paragraphs", () => {
    // «تجنب الكتل النصية الطويلة» — one pasted block becomes readable
    // paragraphs without anyone re-editing the article.
    const { container } = render(<ArticleBlocks lang="ar" blocks={[block({ text: para(12) })]} />);

    expect(container.querySelectorAll("p").length).toBeGreaterThan(1);
  });

  it("paginates a long feature and pages through it", () => {
    const blocks = [
      block({ text: para(20) }),
      block({ type: "heading", text: "الفصل الثاني" }),
      block({ text: para(20) }),
      block({ type: "heading", text: "الفصل الثالث" }),
      block({ text: para(20) }),
    ];
    render(<ArticleBlocks lang="ar" blocks={blocks} />);

    const pager = screen.getByLabelText("صفحات المقال");
    expect(pager).toBeInTheDocument();

    const pageTwo = screen.getByLabelText("صفحة 2");
    fireEvent.click(pageTwo);
    expect(pageTwo).toHaveAttribute("aria-current", "true");
  });

  it("keeps every page in the DOM so the story stays crawlable", () => {
    // regression: unmounting the other pages would take most of the article
    // out of the served HTML — short pages for the reader must not cost the
    // search ranking or in-page find.
    const blocks = [
      block({ text: para(20) }),
      block({ type: "heading", text: "عنوان الصفحة الثانية" }),
      block({ text: para(20) }),
      block({ type: "heading", text: "عنوان الصفحة الثالثة" }),
      block({ text: para(20) }),
    ];
    render(<ArticleBlocks lang="ar" blocks={blocks} />);

    expect(screen.getByText("عنوان الصفحة الثالثة", { ignore: "" })).toBeInTheDocument();
  });

  it("disables «السابق» on the first page", () => {
    const blocks = [
      block({ text: para(20) }),
      block({ type: "heading", text: "ثانياً" }),
      block({ text: para(20) }),
      block({ type: "heading", text: "ثالثاً" }),
      block({ text: para(20) }),
    ];
    render(<ArticleBlocks lang="ar" blocks={blocks} />);

    expect(screen.getByText("الصفحة السابقة")).toBeDisabled();
  });

  it("paints the editor's inline colours", () => {
    const { container } = render(
      <ArticleBlocks lang="ar" blocks={[block({ text: "عادي {c:#B01F2E|ملوّن} و{h:#FFF3B0|مظلّل}" })]} />,
    );

    const html = container.innerHTML;
    expect(html).toContain("rgb(176, 31, 46)");
    expect(html).toContain("rgb(255, 243, 176)");
    expect(screen.getByText("ملوّن")).toBeInTheDocument();
  });

  it("renders a hostile colour value as text, never as markup", () => {
    const { container } = render(
      <ArticleBlocks lang="ar" blocks={[block({ text: "{c:#B01F2E|<img src=x onerror=alert(1)>}" })]} />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
  });
});
