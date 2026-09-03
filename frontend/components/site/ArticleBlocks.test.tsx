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
    align: "right",
    image: null,
    caption: "",
    credit: "",
    related_article: null,
    related_article_slug: null,
    related_article_kind: null,
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

  it("renders the editor's bold/italic/underline markup", () => {
    render(
      <ArticleBlocks
        lang="ar"
        blocks={[block({ text: "عادي {b|غامق} و{i|مائل} و{u|تحته خط}" })]}
      />,
    );

    expect(screen.getByText("غامق")).toHaveStyle({ fontWeight: "700" });
    expect(screen.getByText("مائل")).toHaveStyle({ fontStyle: "italic" });
    expect(screen.getByText("تحته خط")).toHaveStyle({ textDecoration: "underline" });
  });

  it("renders the large («فقرة») markup bigger and bold, even without a separate bold flag", () => {
    render(<ArticleBlocks lang="ar" blocks={[block({ text: "عادي {L|فقرة بارزة} عادي" })]} />);

    expect(screen.getByText("فقرة بارزة")).toHaveStyle({ fontWeight: "700", fontSize: "1.2em" });
  });

  it("preserves a manual line break inside a paragraph", () => {
    const { container } = render(<ArticleBlocks lang="ar" blocks={[block({ text: "سطر أول\nسطر ثانٍ" })]} />);

    expect(container.querySelector("p")).toHaveClass("whitespace-pre-wrap");
  });

  it("renders an image dropped mid-paragraph as an actual photo, not the raw token", () => {
    const { container } = render(
      <ArticleBlocks lang="ar" blocks={[block({ text: "اكد الوزير {img:library/x.jpg} ان سيتم رفع الرواتب" })]} />,
    );

    const img = container.querySelector("img")!;
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toContain("library/x.jpg");
    expect(screen.getByText(/اكد الوزير/)).toBeInTheDocument();
    expect(screen.getByText(/ان سيتم رفع الرواتب/)).toBeInTheDocument();
    expect(container.textContent).not.toContain("{img:");
  });

  it.each([
    ["left", "text-left"],
    ["center", "text-center"],
    ["right", "text-right"],
    ["justify", "text-justify"],
  ] as const)("renders align=%s as %s — physical, not logical", (align, expectedClass) => {
    const { container } = render(<ArticleBlocks lang="ar" blocks={[block({ text: sentence(1), align })]} />);

    expect(container.querySelector("p")).toHaveClass(expectedClass);
  });

  describe("mid-article related news", () => {
    const cards = [
      { href: "/article/a", title: "خبر أول ذو صلة" },
      { href: "/article/b", title: "خبر ثانٍ ذو صلة" },
    ];
    const longEnough = [
      block({ text: sentence(1) }),
      block({ type: "heading", text: "عنوان فرعي" }),
      block({ text: sentence(2) }),
      block({ text: sentence(3) }),
    ];

    it("shows the box, roughly midway through the body, when there's enough content", () => {
      render(<ArticleBlocks lang="ar" blocks={longEnough} relatedCards={cards} />);

      expect(screen.getByText("أخبار ذات صلة")).toBeInTheDocument();
      expect(screen.getByText("خبر أول ذو صلة")).toBeInTheDocument();
      expect(screen.getByText("خبر ثانٍ ذو صلة")).toBeInTheDocument();
    });

    it("still shows the box on a one-block article — inside the body, never pushed down to the end-of-article list", () => {
      // regression: this used to require >= 4 blocks, which skipped the box
      // on most of the site's actual articles (a typical news brief is one
      // or two blocks) — the client only ever saw it on long features and
      // reported the box as missing everywhere else, landing only in the
      // end-of-article list after the comment thread.
      render(<ArticleBlocks lang="ar" blocks={[block({ text: sentence(1) })]} relatedCards={cards} />);

      expect(screen.getByText("أخبار ذات صلة")).toBeInTheDocument();
    });

    it("skips the box entirely when there's nothing related to show", () => {
      render(<ArticleBlocks lang="ar" blocks={longEnough} relatedCards={[]} />);

      expect(screen.queryByText("أخبار ذات صلة")).not.toBeInTheDocument();
    });

    it("never shows a card's timestamp, even when the caller supplied one", () => {
      // The client asked for this box specifically to stay clean/uncluttered
      // — no publish time on its cards, unlike every other place ArticleCard
      // renders. Enforced here rather than by callers omitting `time` from
      // relatedInline, so a future caller that does pass one still can't
      // reintroduce a timestamp into this box.
      render(
        <ArticleBlocks
          lang="ar"
          blocks={longEnough}
          relatedCards={[{ href: "/article/a", title: "خبر أول ذو صلة", time: "منذ ٣ ساعات" }]}
        />,
      );

      expect(screen.getByText("خبر أول ذو صلة")).toBeInTheDocument();
      expect(screen.queryByText("منذ ٣ ساعات")).not.toBeInTheDocument();
    });
  });

  describe("«اقرأ أيضاً» related block", () => {
    // /article/[slug] 404s anything but kind === "news" (see
    // app/article/[slug]'s generateMetadata) — an editor linking this box at
    // an opinion piece must land on /opinion/[slug] instead.
    it("routes a related opinion piece to /opinion/[slug]", () => {
      render(
        <ArticleBlocks
          lang="ar"
          blocks={[block({ type: "related", text: "عمود رأي مرتبط", related_article_slug: "col-1", related_article_kind: "opinion" })]}
        />,
      );

      expect(screen.getByText("عمود رأي مرتبط").closest("a")).toHaveAttribute("href", "/opinion/col-1");
    });

    it("routes a related news article to /article/[slug]", () => {
      render(
        <ArticleBlocks
          lang="ar"
          blocks={[block({ type: "related", text: "خبر مرتبط", related_article_slug: "news-1", related_article_kind: "news" })]}
        />,
      );

      expect(screen.getByText("خبر مرتبط").closest("a")).toHaveAttribute("href", "/article/news-1");
    });

    it("falls back to /article/[slug] when the target's kind wasn't sent", () => {
      // Defends the `?? "news"` fallback in the component — an older API
      // response or a stale cached page without related_article_kind must
      // still resolve to something rather than crash.
      render(
        <ArticleBlocks
          lang="ar"
          blocks={[block({ type: "related", text: "خبر بلا نوع", related_article_slug: "unknown-kind" })]}
        />,
      );

      expect(screen.getByText("خبر بلا نوع").closest("a")).toHaveAttribute("href", "/article/unknown-kind");
    });
  });
});
