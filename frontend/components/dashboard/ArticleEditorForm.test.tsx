import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ArticleEditorForm from "./ArticleEditorForm";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const dashMutate = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, dashMutate: (...args: unknown[]) => dashMutate(...args) };
});

const sections = [{ id: 1, key: "egypt", label: "شؤون مصر" }];

describe("ArticleEditorForm save feedback", () => {
  afterEach(() => {
    push.mockClear();
    refresh.mockClear();
    dashMutate.mockReset();
  });

  it("blocks the save and explains why when the title is empty", async () => {
    render(<ArticleEditorForm initial={null} sections={sections} />);

    fireEvent.click(screen.getByText("حفظ ونشر"));

    expect(await screen.findByRole("alert")).toHaveTextContent("لازم تكتب عنوان الخبر أولاً");
    expect(dashMutate).not.toHaveBeenCalled();
  });

  it("navigates to the articles list on a successful save", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);

    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر تجريبي" } });
    await act(async () => {
      fireEvent.click(screen.getByText("حفظ ونشر"));
    });

    expect(push).toHaveBeenCalledWith("/dashboard/articles");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("surfaces the server's validation message instead of failing silently", async () => {
    const { ApiError } = await import("@/lib/api");
    dashMutate.mockRejectedValue(new ApiError("/articles/", 400, "Bad Request", { section: ["This field is required."] }));
    render(<ArticleEditorForm initial={null} sections={sections} />);

    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر تجريبي" } });
    await act(async () => {
      fireEvent.click(screen.getByText("حفظ ونشر"));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("القسم: This field is required.");
    expect(push).not.toHaveBeenCalled();
  });

  it("clears a previous error on the next save attempt", async () => {
    dashMutate.mockResolvedValueOnce({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);

    fireEvent.click(screen.getByText("حفظ ونشر"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر تجريبي" } });
    await act(async () => {
      fireEvent.click(screen.getByText("حفظ ونشر"));
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
