import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import VideoComments from "./VideoComments";
import type { VideoComment } from "@/lib/types";

const apiMutate = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, apiMutate: (...args: unknown[]) => apiMutate(...args) };
});

const initial: VideoComment[] = [
  { id: 1, video: 5, name: "قارئ", initial: "ق", text: "تعليق سابق", created_at: "2026-01-01T00:00:00Z" },
];

describe("VideoComments", () => {
  afterEach(() => apiMutate.mockReset());

  it("posts a comment and shows the server's version once saved", async () => {
    const created: VideoComment = { id: 99, video: 5, name: "أنت", initial: "أ", text: "تعليق جديد", created_at: "2026-07-28T00:00:00Z" };
    apiMutate.mockResolvedValue(created);
    render(<VideoComments videoId={5} initial={initial} />);

    fireEvent.change(screen.getByPlaceholderText("أضف تعليقاً..."), { target: { value: "تعليق جديد" } });
    await act(async () => {
      fireEvent.click(screen.getByText("نشر"));
    });

    expect(screen.getByText("تعليق جديد")).toBeInTheDocument();
    expect(screen.getByText("التعليقات (2)")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not fabricate a fake comment when the post fails, and reports the failure", async () => {
    apiMutate.mockRejectedValue(new Error("network down"));
    render(<VideoComments videoId={5} initial={initial} />);

    const textarea = screen.getByPlaceholderText("أضف تعليقاً...") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "تعليق لن يُحفظ" } });
    await act(async () => {
      fireEvent.click(screen.getByText("نشر"));
    });

    // No fake local row was inserted — comment count stays at the original,
    // and the failed text only exists back in the draft textarea, not as a
    // posted comment entry.
    expect(screen.getByText("التعليقات (1)")).toBeInTheDocument();
    expect(screen.queryByText("تعليق لن يُحفظ", { selector: "p" })).not.toBeInTheDocument();
    expect(textarea.value).toBe("تعليق لن يُحفظ");
    // The failure is surfaced, not hidden behind a fake success.
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
