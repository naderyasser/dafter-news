import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MediaLibraryPicker from "./MediaLibraryPicker";
import type { MediaAsset } from "@/lib/types";

const asset = (over: Partial<MediaAsset> = {}): MediaAsset => ({
  id: 1,
  image: "/media/library/president.jpg",
  title: "الرئيس في افتتاح المحور",
  alt: "",
  credit: "وكالة الدفتر",
  license: "owned",
  license_label: "ملكية الدفتر",
  source: "",
  article: null,
  article_title: null,
  article_slug: null,
  created_at: "2026-07-01T00:00:00Z",
  ...over,
});

const getMediaAssets = vi.fn();
vi.mock("@/lib/api", () => ({
  getMediaAssets: (...args: unknown[]) => getMediaAssets(...args),
  mediaUrl: (path: string | null) => path,
}));

/** The picker debounces typing by 250ms before it searches. */
const settle = async () => {
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
};

describe("MediaLibraryPicker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getMediaAssets.mockResolvedValue({ count: 1, next: null, previous: null, results: [asset()] });
  });
  afterEach(() => {
    vi.useRealTimers();
    getMediaAssets.mockReset();
  });

  it("lists the library on open and searches by name", async () => {
    render(<MediaLibraryPicker onPick={() => {}} onClose={() => {}} />);
    await settle();

    expect(screen.getByText("الرئيس في افتتاح المحور")).toBeInTheDocument();
    expect(getMediaAssets).toHaveBeenLastCalledWith("");

    fireEvent.change(screen.getByLabelText("ابحث في مكتبة الصور"), { target: { value: "الرئيس" } });
    await settle();

    expect(getMediaAssets).toHaveBeenLastCalledWith(`?search=${encodeURIComponent("الرئيس")}`);
  });

  it("hands the chosen asset to onPick", async () => {
    const onPick = vi.fn();
    render(<MediaLibraryPicker onPick={onPick} onClose={() => {}} />);
    await settle();

    fireEvent.click(screen.getByText("الرئيس في افتتاح المحور"));

    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 1, credit: "وكالة الدفتر" }));
  });

  it("offers the upload page when nothing matches", async () => {
    getMediaAssets.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
    render(<MediaLibraryPicker onPick={() => {}} onClose={() => {}} />);
    await settle();

    expect(screen.getByText(/لا توجد نتائج/)).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<MediaLibraryPicker onPick={() => {}} onClose={onClose} />);
    await settle();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });
});
