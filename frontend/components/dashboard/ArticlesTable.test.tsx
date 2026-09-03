import { act, fireEvent, render, screen } from "@testing-library/react";
import { DASHBOARD } from "@/lib/routes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ArticlesTable from "./ArticlesTable";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const routerReplace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: routerReplace }) }));

const dashMutate = vi.fn();
vi.mock("@/lib/api", () => ({ dashMutate: (...args: unknown[]) => dashMutate(...args) }));

const revalidateSite = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/revalidate", () => ({ revalidateSite: (...args: unknown[]) => revalidateSite(...args) }));

const rows = [
  { id: 1, title: "الخبر الأول", section: "شؤون مصر", author: "محمد", status: "published" as const, views: 100, date: "منذ يوم" },
  { id: 2, title: "الخبر الثاني", section: "حركة السوق", author: "سامية", status: "draft" as const, views: 0, date: "منذ يومين" },
];

describe("ArticlesTable delete", () => {
  beforeEach(() => {
    vi.stubGlobal("confirm", vi.fn(() => true));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    dashMutate.mockReset();
    revalidateSite.mockClear();
  });

  it("asks for confirmation before deleting", async () => {
    vi.mocked(confirm).mockReturnValue(false);
    render(<ArticlesTable rows={rows} />);

    fireEvent.click(screen.getAllByTitle("حذف")[0]);

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("الخبر الأول"));
    expect(dashMutate).not.toHaveBeenCalled();
    expect(screen.getByText("الخبر الأول")).toBeInTheDocument();
  });

  it("removes the row once the server confirms the delete", async () => {
    dashMutate.mockResolvedValue(undefined);
    render(<ArticlesTable rows={rows} />);

    await act(async () => {
      fireEvent.click(screen.getAllByTitle("حذف")[0]);
    });

    expect(screen.queryByText("الخبر الأول")).not.toBeInTheDocument();
  });

  it("restores the row and explains the failure when the delete is rejected", async () => {
    dashMutate.mockRejectedValue(new Error("network"));
    render(<ArticlesTable rows={rows} />);

    await act(async () => {
      fireEvent.click(screen.getAllByTitle("حذف")[0]);
    });

    expect(screen.getByText("الخبر الأول")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("تعذّر حذف «الخبر الأول»");
  });

  /**
   * Regression: the public home page held a deleted story's card — image,
   * headline and all — for up to a minute after the delete had actually
   * gone through, because nothing ever told the site's cache the row was
   * gone. revalidateSite() existed for exactly this and was never called.
   */
  it("busts the public site's cache once the delete is confirmed", async () => {
    dashMutate.mockResolvedValue(undefined);
    render(<ArticlesTable rows={rows} />);

    await act(async () => {
      fireEvent.click(screen.getAllByTitle("حذف")[0]);
    });

    expect(revalidateSite).toHaveBeenCalled();
  });

  it("does not bust the cache when the delete fails", async () => {
    dashMutate.mockRejectedValue(new Error("network"));
    render(<ArticlesTable rows={rows} />);

    await act(async () => {
      fireEvent.click(screen.getAllByTitle("حذف")[0]);
    });

    expect(revalidateSite).not.toHaveBeenCalled();
  });
});

/**
 * Regression: ArticleEditorForm.save() navigated away on success with
 * nothing else on screen to show for it — no toast, no banner — which read
 * as "did that even work?" to an editor who'd just hit «حفظ ونشر». The
 * redirect's own `?saved=1` (read as the `justSaved` page prop, not a
 * client-side query hook) is the one signal that a save actually landed.
 */
describe("ArticlesTable save confirmation", () => {
  afterEach(() => {
    routerReplace.mockClear();
  });

  it("shows a success banner when arriving from a just-completed save", () => {
    render(<ArticlesTable rows={rows} justSaved />);

    expect(screen.getByRole("status")).toHaveTextContent("تم حفظ الخبر بنجاح");
  });

  it("shows nothing extra on a plain visit to the list", () => {
    render(<ArticlesTable rows={rows} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("strips ?saved=1 back out of the URL so a later reload doesn't re-show it", () => {
    render(<ArticlesTable rows={rows} justSaved />);

    expect(routerReplace).toHaveBeenCalledWith(`${DASHBOARD}/articles`, { scroll: false });
  });

  it("closes when dismissed", () => {
    render(<ArticlesTable rows={rows} justSaved />);

    fireEvent.click(screen.getByLabelText("إغلاق"));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("ArticlesTable edit action", () => {
  /**
   * Regression: the ✎ edit link used to render at opacity:0, only reaching
   * opacity:1 on :hover — undiscoverable on a touchscreen (no hover state at
   * all) and easy to miss even with a mouse, which is exactly what "there's
   * no way to edit a published article" was describing.
   */
  it("links every row straight to its editor, always visible — not only on hover", () => {
    render(<ArticlesTable rows={rows} />);

    const editLinks = screen.getAllByTitle("تعديل");
    expect(editLinks).toHaveLength(rows.length);
    expect(editLinks[0]).toHaveAttribute("href", `${DASHBOARD}/articles/1/edit`);
    expect(editLinks[1]).toHaveAttribute("href", `${DASHBOARD}/articles/2/edit`);
    // No opacity-based visibility gate left on the action.
    editLinks.forEach((el) => expect(el).not.toHaveStyle({ opacity: 0 }));
  });
});

describe("ArticlesTable initialQuery", () => {
  it("opens already filtered by the top bar's ?q= search", () => {
    render(<ArticlesTable rows={rows} initialQuery="الثاني" />);

    expect(screen.getByDisplayValue("الثاني")).toBeInTheDocument();
    expect(screen.getByText("الخبر الثاني")).toBeInTheDocument();
    expect(screen.queryByText("الخبر الأول")).not.toBeInTheDocument();
  });
});

describe("ArticlesTable initialQuery", () => {
  it("opens already filtered by the top bar's ?q= search", () => {
    render(<ArticlesTable rows={rows} initialQuery="الثاني" />);

    expect(screen.getByText("الخبر الثاني")).toBeInTheDocument();
    expect(screen.queryByText("الخبر الأول")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("بحث في المقالات...")).toHaveValue("الثاني");
  });
});
