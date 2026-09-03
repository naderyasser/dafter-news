import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LatestNewsTabs from "./LatestNewsTabs";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const latest = [
  { href: "/article/l1", title: "الأحدث الأول", time: "منذ دقيقة" },
  { href: "/article/l2", title: "الأحدث الثاني", time: "منذ ساعة" },
];
// Deliberately not "الأكثر تعليقاً" — that is the tab's own label, and a
// fixture that collides with it would make the query pass on the button.
const popular = [{ href: "/article/p1", title: "الخبر صاحب أكبر نقاش", time: "12 تعليق" }];

describe("LatestNewsTabs", () => {
  it("opens on the latest tab", () => {
    render(<LatestNewsTabs lang="ar" latest={latest} popular={popular} />);

    expect(screen.getByText("الأحدث الأول")).toBeInTheDocument();
    expect(screen.queryByText("الخبر صاحب أكبر نقاش")).not.toBeInTheDocument();
  });

  it("swaps the list — and only the list — when the other tab is picked", async () => {
    render(<LatestNewsTabs lang="ar" latest={latest} popular={popular} />);

    await act(async () => screen.getByRole("button", { name: "الأكثر تعليقاً" }).click());

    expect(screen.getByText("12 تعليق")).toBeInTheDocument();
    expect(screen.queryByText("الأحدث الأول")).not.toBeInTheDocument();
    // The heading is the block's identity, not the tab's — it must not follow.
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("أحدث الأخبار");
  });

  it("marks the active chip so the tab pair is readable at a glance", async () => {
    render(<LatestNewsTabs lang="ar" latest={latest} popular={popular} />);
    const [latestChip, popularChip] = screen.getAllByRole("button");

    expect(latestChip.className).toContain("bg-brand");
    expect(popularChip.className).not.toContain("bg-brand");

    await act(async () => popularChip.click());

    expect(screen.getAllByRole("button")[1].className).toContain("bg-brand");
    expect(screen.getAllByRole("button")[0].className).not.toContain("bg-brand");
  });

  it("survives an empty side without collapsing the block", async () => {
    render(<LatestNewsTabs lang="ar" latest={latest} popular={[]} />);

    await act(async () => screen.getByRole("button", { name: "الأكثر تعليقاً" }).click());

    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(screen.queryByText("الأحدث الأول")).not.toBeInTheDocument();
  });

  it("says the popular tab is empty rather than echoing the latest list", async () => {
    // The newsroom reported the two tabs as swapped. They never were: an
    // unfiltered -comment_count ranking ties at zero for nearly every story
    // and breaks the tie on -published_at, so the tab rendered the newest
    // news. The pool is filtered now, so empty is a real state — and it has
    // to READ as empty rather than as a copy of the other tab.
    render(<LatestNewsTabs lang="ar" latest={latest} popular={[]} />);

    await act(async () => screen.getByRole("button", { name: "الأكثر تعليقاً" }).click());

    expect(screen.getByText("لا توجد أخبار عليها تعليقات بعد.")).toBeInTheDocument();
  });

  it("keeps the empty note off the latest tab, which can never be empty", () => {
    render(<LatestNewsTabs lang="ar" latest={[]} popular={popular} />);

    expect(screen.queryByText("لا توجد أخبار عليها تعليقات بعد.")).not.toBeInTheDocument();
  });

  it("states the empty case in English too", async () => {
    render(<LatestNewsTabs lang="en" latest={latest} popular={[]} />);

    await act(async () => screen.getByRole("button", { name: "Most Commented" }).click());

    expect(screen.getByText("No stories have been commented on yet.")).toBeInTheDocument();
  });

  it("speaks English on the English edition", () => {
    render(<LatestNewsTabs lang="en" latest={latest} popular={popular} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Latest News");
    expect(screen.getByRole("button", { name: "Most Commented" })).toBeInTheDocument();
  });
});
