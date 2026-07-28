import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MediaManager from "./MediaManager";
import type { MediaAsset } from "@/lib/types";

const dashMutate = vi.fn();
const dashUpload = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    dashMutate: (...args: unknown[]) => dashMutate(...args),
    dashUpload: (...args: unknown[]) => dashUpload(...args),
  };
});

const asset = (id: number, title: string): MediaAsset => ({
  id,
  image: `/media/${title}.jpg`,
  title,
  alt: "",
  credit: "",
  license: "owned",
  license_label: "ملكية الدفتر",
  source: "",
  article: null,
  article_title: null,
  article_slug: null,
  created_at: "2026-01-01",
});

const file = (name: string) => new File(["x"], name, { type: "image/png" });

describe("MediaManager bulk upload", () => {
  afterEach(() => {
    dashMutate.mockReset();
    dashUpload.mockReset();
  });

  it("keeps the files that already uploaded when a later file in the same drop fails", async () => {
    dashUpload
      .mockResolvedValueOnce(asset(1, "one"))
      .mockResolvedValueOnce(asset(2, "two"))
      .mockRejectedValueOnce(new Error("400 bad type"));

    render(<MediaManager assets={[]} articles={[]} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file("one.png"), file("two.png"), file("three.png")] } });
    });

    // Files 1 and 2 were already persisted server-side before file 3 failed —
    // they must still show up in the grid instead of vanishing.
    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByText("two")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("رُفعت 2 من 3");
    expect(dashUpload).toHaveBeenCalledTimes(3);
  });

  it("shows the generic failure message when nothing in the batch uploaded", async () => {
    dashUpload.mockRejectedValue(new Error("400 bad type"));
    render(<MediaManager assets={[]} articles={[]} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file("one.png")] } });
    });

    expect(screen.getByRole("alert")).toHaveTextContent("تعذّر رفع الصور");
    expect(screen.queryByText(/رُفعت/)).not.toBeInTheDocument();
  });
});
