import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LiveManager from "./LiveManager";
import type { LiveStream } from "@/lib/types";

const dashMutate = vi.fn();
vi.mock("@/lib/api", () => ({ dashMutate: (...args: unknown[]) => dashMutate(...args) }));

const stream: LiveStream = {
  id: 1,
  title: "بث تجريبي",
  is_live: false,
  updates: [{ id: 1, stream: 1, time_label: "10:00", text: "بداية التغطية", created_at: "2026-01-01" }],
};

describe("LiveManager", () => {
  afterEach(() => dashMutate.mockReset());

  it("adds an update once the server confirms it", async () => {
    dashMutate.mockResolvedValue({ id: 2, stream: 1, time_label: "10:05", text: "تحديث جديد", created_at: "2026-01-01" });
    render(<LiveManager stream={stream} />);

    fireEvent.change(screen.getByPlaceholderText("أضف تحديثاً جديداً للتغطية اللحظية..."), { target: { value: "تحديث جديد" } });
    await act(async () => {
      fireEvent.click(screen.getByText("نشر"));
    });

    expect(screen.getByText("تحديث جديد")).toBeInTheDocument();
  });

  it("does not post a fake update to the timeline when the request fails, and restores the draft", async () => {
    dashMutate.mockRejectedValue(new Error("network"));
    render(<LiveManager stream={stream} />);

    fireEvent.change(screen.getByPlaceholderText("أضف تحديثاً جديداً للتغطية اللحظية..."), { target: { value: "تحديث فاشل" } });
    await act(async () => {
      fireEvent.click(screen.getByText("نشر"));
    });

    expect(screen.queryByText("تحديث فاشل")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("تعذّر نشر التحديث");
    expect(screen.getByPlaceholderText("أضف تحديثاً جديداً للتغطية اللحظية...")).toHaveValue("تحديث فاشل");
  });

  it("reverts the live toggle and explains the failure when the server rejects it", async () => {
    dashMutate.mockRejectedValue(new Error("network"));
    render(<LiveManager stream={stream} />);

    await act(async () => {
      fireEvent.click(screen.getByText("● بدء البث"));
    });

    expect(screen.getByText("البث متوقف")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("تعذّر بدء البث");
  });
});
