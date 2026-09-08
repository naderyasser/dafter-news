import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, fill: _fill, ...rest }: any) => <img src={src} alt={alt} {...rest} />,
}));

import CompactListBlock from "./CompactListBlock";
import type { ArticleCard } from "@/lib/types";

const card = (over: Partial<ArticleCard> = {}): ArticleCard =>
  ({
    id: 1,
    title: "الداخلية تكشف حقيقة الفيديو المتداول",
    slug: "interior-clarifies",
    href_slug: "interior-clarifies",
    section_name: "أمن ومحاكم",
    subcategory: "",
    country: "",
    badge: "none",
    status: "published",
    cover_image: null,
    cover_image_width: null,
    cover_image_height: null,
    standfirst: "",
    published_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
    views: 0,
    kind: "news",
    comment_count: 0,
    author_name: null,
    author_name_en: null,
    author_username: null,
    author_initial: null,
    author_avatar: null,
    excerpt: "",
    ...over,
  }) as ArticleCard;

/**
 * Layout variant V3 — the headline-only list the height budget is won with.
 *
 * The contract worth pinning is that density costs nothing editorially: the
 * same headlines, the same links, the same timestamps as a photo-led block,
 * minus the photographs.
 */
describe("CompactListBlock", () => {
  it("renders every story as a link, losing none to the compact layout", () => {
    const cards = [card({ id: 1 }), card({ id: 2, slug: "b" }), card({ id: 3, slug: "c" })];
    render(<CompactListBlock lang="ar" title="أمن ومحاكم" href="/section/security" cards={cards} />);

    expect(screen.getAllByRole("link")).toHaveLength(
      // three stories plus the heading link and its «عرض الكل» affordance
      cards.length + 2,
    );
  });

  it("carries a machine-readable timestamp on each row", () => {
    const { container } = render(
      <CompactListBlock lang="ar" title="أمن ومحاكم" href="/section/security" cards={[card()]} />,
    );

    const time = container.querySelector("time");
    expect(time).toBeInTheDocument();
    expect(time).toHaveAttribute("dateTime");
    expect(time!.textContent).toMatch(/منذ/);
  });

  it("routes an opinion piece to /opinion and a news story to /article", () => {
    render(
      <CompactListBlock
        lang="ar"
        title="مختلط"
        href="/section/x"
        cards={[
          card({ id: 1, slug: "news-one", title: "خبر أمني" }),
          card({ id: 2, slug: "col", kind: "opinion", title: "عمود رأي" }),
        ]}
      />,
    );

    // The row numeral is aria-hidden, so it is absent from the accessible
    // name — decoration for the eye, not something a screen reader reads out.
    expect(screen.getByRole("link", { name: /^خبر أمني/ })).toHaveAttribute("href", "/article/news-one");
    expect(screen.getByRole("link", { name: /^عمود رأي/ })).toHaveAttribute("href", "/opinion/col");
  });

  it("numbers the rows so the eye can track a column with no images", () => {
    render(
      <CompactListBlock lang="ar" title="أمن" href="/s" cards={[card({ id: 1 }), card({ id: 2, slug: "b" })]} />,
    );

    const list = screen.getByRole("list");
    expect(within(list).getByText("1")).toBeInTheDocument();
    expect(within(list).getByText("2")).toBeInTheDocument();
  });

  it("gives every row the site's one square thumbnail — the client's uniformity ask", () => {
    const { container } = render(
      <CompactListBlock lang="ar" title="أمن" href="/s" cards={[card({ cover_image: "/media/covers/a.jpg" }), card({ id: 2, slug: "b" })]} />,
    );

    // Two rows, two square frames: the second falls to the site mark rather
    // than to no image, so the column of thumbnails never has a hole in it.
    expect(container.querySelectorAll(".aspect-square")).toHaveLength(2);
    expect(container.querySelector('img[src="/media/covers/a.jpg"]')).not.toBeNull();
    expect(container.querySelector('img[src="/icon.png"]')).not.toBeNull();
  });

  it("tints its panel with the desk's own colour so two desks never look alike", () => {
    const { container } = render(
      <CompactListBlock lang="ar" title="أمن" href="/s" sectionKey="security" cards={[card()]} />,
    );

    expect(container.querySelector(".rounded-2xl")).toHaveStyle({ backgroundColor: "#41556E0D" });
  });

  it("spotlight: leads with the newest story at a larger size, then numbers the rest from 2", () => {
    render(
      <CompactListBlock
        lang="ar"
        title="دليلك الأول"
        href="/section/guide"
        sectionKey="guide"
        layout="spotlight"
        cards={[card({ id: 1, standfirst: "الإجابة المختصرة" }), card({ id: 2, slug: "b", title: "خبر ثانٍ" }), card({ id: 3, slug: "c", title: "خبر ثالث" })]}
      />,
    );

    expect(screen.getByText("الإجابة المختصرة")).toBeInTheDocument();
    const list = screen.getByRole("list");
    expect(within(list).getByText("2")).toBeInTheDocument();
    expect(within(list).queryByText("1")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(3 + 2);
  });

  it("spotlight with a single story is just the lead row", () => {
    render(<CompactListBlock lang="ar" title="سياسة" href="/section/pol" layout="spotlight" cards={[card()]} />);

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /الداخلية/ })).toBeInTheDocument();
  });

  it("renders nothing rather than a heading over an empty grid", () => {
    const { container } = render(<CompactListBlock lang="ar" title="أمن ومحاكم" href="/s" cards={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("omits the stamp for a story that was never published", () => {
    const { container } = render(
      <CompactListBlock lang="ar" title="أمن" href="/s" cards={[card({ published_at: null })]} />,
    );

    // An empty <time> is worse than an absent one for a crawler.
    expect(container.querySelector("time")).toBeNull();
    expect(screen.getByRole("link", { name: /الداخلية/ })).toBeInTheDocument();
  });

  it("keeps long Arabic headlines intact rather than truncating in JS", () => {
    const long = "ال" + "طويل ".repeat(40).trim();
    render(<CompactListBlock lang="ar" title="أمن" href="/s" cards={[card({ title: long })]} />);

    // Clamping is CSS's job; the text itself must reach the DOM whole so a
    // crawler and a screen reader get the real headline.
    expect(screen.getByText(long)).toBeInTheDocument();
  });
  it("hides the stamp entirely when showTime is false", () => {
    // The home page passes showTime={false}: a newsroom this size cannot
    // refile hourly, and a column of «منذ يومين» down the front page reads
    // as an abandoned site. Section pages keep their stamps.
    const { container } = render(
      <CompactListBlock lang="ar" title="أمن" href="/s" cards={[card()]} showTime={false} />,
    );

    expect(container.querySelector("time")).toBeNull();
    // The headline and its link are untouched — only the stamp goes.
    expect(screen.getByRole("link", { name: /الداخلية/ })).toHaveAttribute("href", "/article/interior-clarifies");
  });
});
