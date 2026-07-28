import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ArticlesTable from "./ArticlesTable";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const dashMutate = vi.fn();
vi.mock("@/lib/api", () => ({ dashMutate: (...args: unknown[]) => dashMutate(...args) }));

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
});
