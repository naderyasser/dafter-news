import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ImportFromUrl from "./ImportFromUrl";

const apiMutate = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, apiMutate: (...args: unknown[]) => apiMutate(...args) };
});

describe("ImportFromUrl", () => {
  afterEach(() => apiMutate.mockReset());

  it("posts the pasted url and hands the draft back on success", async () => {
    const draft = {
      title: "عنوان مستورد",
      standfirst: "مقدمة",
      paragraphs: ["فقرة أولى", "فقرة ثانية"],
      byline: "منقول عن example.com",
      cover_asset_id: 12,
      cover_image: "/media/library/x.jpg",
    };
    apiMutate.mockResolvedValue(draft);
    const onImported = vi.fn();
    render(<ImportFromUrl onImported={onImported} />);

    fireEvent.change(screen.getByLabelText("رابط الخبر"), { target: { value: "https://example.com/news/1" } });
    await act(async () => fireEvent.click(screen.getByText("استيراد")));

    expect(apiMutate).toHaveBeenCalledWith("/import-from-url/", "POST", { url: "https://example.com/news/1" });
    expect(onImported).toHaveBeenCalledWith(draft);
  });

  it("clears the field after a successful import, ready for the next one", async () => {
    apiMutate.mockResolvedValue({ title: "", standfirst: "", paragraphs: [], byline: "", cover_asset_id: null, cover_image: null });
    render(<ImportFromUrl onImported={vi.fn()} />);
    const input = screen.getByLabelText("رابط الخبر") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "https://example.com/news/1" } });
    await act(async () => fireEvent.click(screen.getByText("استيراد")));

    expect(input.value).toBe("");
  });

  it("surfaces a failed import instead of silently doing nothing", async () => {
    const { ApiError } = await import("@/lib/api");
    apiMutate.mockRejectedValue(new ApiError("/import-from-url/", 422, "Unprocessable", { detail: "لم يُعثر على محتوى." }));
    render(<ImportFromUrl onImported={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("رابط الخبر"), { target: { value: "https://example.com/empty" } });
    await act(async () => fireEvent.click(screen.getByText("استيراد")));

    expect(await screen.findByRole("alert")).toHaveTextContent("لم يُعثر على محتوى.");
  });

  it("does nothing on an empty url", async () => {
    render(<ImportFromUrl onImported={vi.fn()} />);

    expect(screen.getByText("استيراد")).toBeDisabled();
    expect(apiMutate).not.toHaveBeenCalled();
  });
});
