import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CommentsManager from "./CommentsManager";
import type { Comment } from "@/lib/types";

const dashMutate = vi.fn();
vi.mock("@/lib/api", () => ({ dashMutate: (...args: unknown[]) => dashMutate(...args) }));

const comments: Comment[] = [
  { id: 1, article: 1, article_title: "خبر تجريبي", user_name: "قارئ", text: "تعليق معلّق", status: "pending", created_at: "2026-01-01" },
];

describe("CommentsManager", () => {
  afterEach(() => dashMutate.mockReset());

  it("reverts the moderation status and reports the failure", async () => {
    dashMutate.mockRejectedValue(new Error("network"));
    render(<CommentsManager comments={comments} />);

    await act(async () => {
      fireEvent.click(screen.getByTitle("قبول"));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("تعذّر تحديث حالة التعليق");
    // Still filed under "معلّق" (pending), not silently promoted to approved.
    expect(screen.getByText("تعليق معلّق")).toBeInTheDocument();
  });

  it("applies the new status once the server confirms it", async () => {
    dashMutate.mockResolvedValue({});
    render(<CommentsManager comments={comments} />);

    await act(async () => {
      fireEvent.click(screen.getByTitle("قبول"));
    });

    fireEvent.click(screen.getByText("الكل"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
