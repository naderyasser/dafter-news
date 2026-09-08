import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReelsManager from "./ReelsManager";
import type { Reel } from "@/lib/types";

const dashMutate = vi.fn();
const dashUpload = vi.fn();
vi.mock("@/lib/api", async () => {
  const real = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ApiError: real.ApiError,
    describeApiError: real.describeApiError,
    dashMutate: (...a: unknown[]) => dashMutate(...a),
    dashUpload: (...a: unknown[]) => dashUpload(...a),
    mediaUrl: (p?: string | null) => p ?? undefined,
  };
});

const reel = (over: Partial<Reel> = {}): Reel => ({
  id: 1,
  title: "لقطة من المؤتمر",
  thumbnail: "/media/reels/a.jpg",
  url: "https://www.youtube.com/shorts/AAAAAAAAAA1",
  youtube_id: "AAAAAAAAAA1",
  order: 0,
  created_at: "2026-08-01T00:00:00Z",
  ...over,
});

afterEach(() => {
  dashMutate.mockReset();
  dashUpload.mockReset();
  vi.restoreAllMocks();
});

describe("ReelsManager", () => {
  it("counts the shelf and says where the cards go", () => {
    render(<ReelsManager reels={[reel(), reel({ id: 2, title: "الحصاد" })]} />);

    expect(screen.getByText("2 ريل")).toBeInTheDocument();
    expect(screen.getByText(/يشغّل الريل في نافذة فوق الصفحة/)).toBeInTheDocument();
  });

  it("previews each poster in a fixed-width vertical tile, not a stretching grid track", () => {
    // regression: a `grid-cols-[repeat(auto-fit,minmax(…,1fr))]` track handed
    // a sparse row's leftover width to whatever cards existed — with the one
    // real reel on the site, that meant the entire content width, and since
    // the poster is aspect-[9/16] rather than a fixed size, growing the width
    // grew the height to match: one enormous vertical column, cropped deep
    // into the source photo by object-cover. That is what got reported as a
    // stretched image. A card fixed to `w-48` cannot inflate no matter how
    // many reels exist — the row wraps instead.
    const { container } = render(<ReelsManager reels={[reel()]} />);

    const tile = container.querySelector(".w-48");
    expect(tile).not.toBeNull();
    expect(tile!.querySelector(".aspect-\\[9\\/16\\]")).not.toBeNull();
    expect(container.querySelector('[class*="minmax"]')).toBeNull();
  });

  it("requires only a link before it will save", async () => {
    render(<ReelsManager reels={[]} />);
    await act(async () => screen.getByRole("button", { name: /إضافة ريل/ }).click());

    const save = screen.getByRole("button", { name: "حفظ" });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText("رابط الريل على يوتيوب"), {
      target: { value: "https://youtube.com/shorts/AAAAAAAAAA9" },
    });
    expect(save).toBeEnabled();
  });

  it("never asks the editor for a title or a poster — the server scrapes both", async () => {
    render(<ReelsManager reels={[]} />);
    await act(async () => screen.getByRole("button", { name: /إضافة ريل/ }).click());

    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByLabelText("العنوان")).toBeNull();
    expect(screen.getByText(/يُجلبان تلقائياً من يوتيوب/)).toBeInTheDocument();
  });

  it("puts the link field first and focuses it, since it's now the only field", async () => {
    render(<ReelsManager reels={[]} />);
    await act(async () => screen.getByRole("button", { name: /إضافة ريل/ }).click());

    expect(screen.getByLabelText("رابط الريل على يوتيوب")).toHaveFocus();
  });

  it("says a poster-less card is a failed fetch, not a blank screen", () => {
    // The reported bug: a tall empty rectangle reads as a screen that did not
    // render. It has to say which of the two it is.
    render(<ReelsManager reels={[reel({ thumbnail: null })]} />);

    expect(screen.getByText("تعذّر جلب الصورة من يوتيوب")).toBeInTheDocument();
  });

  it("flags a row whose link is not a YouTube video as unsupported and off the site", () => {
    // The Facebook-era rows the migration kept: the public API never serves
    // them, so the dashboard has to say so rather than let the tile look live.
    render(<ReelsManager reels={[reel({ url: "https://www.facebook.com/reel/1/", youtube_id: "" })]} />);

    expect(screen.getByRole("status")).toHaveTextContent("رابط غير مدعوم");
  });

  it("does not flag a normal YouTube reel", () => {
    render(<ReelsManager reels={[reel()]} />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("surfaces the API's own reason when a link is refused", async () => {
    const { ApiError } = await import("@/lib/api");
    dashUpload.mockRejectedValue(new ApiError("/reels/", 400, "Bad Request", { url: ["الرابط لازم يكون رابط فيديو على يوتيوب."] }));
    render(<ReelsManager reels={[]} />);
    await act(async () => screen.getByRole("button", { name: /إضافة ريل/ }).click());
    fireEvent.change(screen.getByLabelText("رابط الريل على يوتيوب"), { target: { value: "https://example.com/x" } });

    await act(async () => screen.getByRole("button", { name: "حفظ" }).click());

    expect(await screen.findByRole("alert")).toHaveTextContent("رابط فيديو على يوتيوب");
  });

  it("posts the link and nothing else", async () => {
    // The server fills in title and thumbnail from the scrape, so the created
    // row this resolves with already carries both — nothing else to send.
    dashUpload.mockResolvedValue(reel({ id: 7, title: "صرف مستشفى العامرية" }));
    render(<ReelsManager reels={[]} />);
    await act(async () => screen.getByRole("button", { name: /إضافة ريل/ }).click());

    fireEvent.change(screen.getByLabelText("رابط الريل على يوتيوب"), {
      target: { value: "https://youtube.com/shorts/AAAAAAAAAA9" },
    });
    await act(async () => screen.getByRole("button", { name: "حفظ" }).click());

    await waitFor(() => expect(dashUpload).toHaveBeenCalled());
    const [path, method, form] = dashUpload.mock.calls[0] as [string, string, FormData];
    expect(path).toBe("/reels/");
    expect(method).toBe("POST");
    expect(form.get("url")).toBe("https://youtube.com/shorts/AAAAAAAAAA9");
    // No `title` key, no `thumbnail` key: neither is the editor's job.
    expect([...form.keys()]).toEqual(["url"]);
    expect(await screen.findByText("صرف مستشفى العامرية")).toBeInTheDocument();
  });

  it("reorders by swapping the two rows, not by renumbering the rail", async () => {
    dashMutate.mockResolvedValue({});
    render(<ReelsManager reels={[reel({ id: 1, title: "الأول" }), reel({ id: 2, title: "الثاني" })]} />);

    // Both default to order 0, so the swap has to fall back to positions or
    // the first nudge on an untouched rail would write the same value twice.
    await act(async () => screen.getAllByRole("button", { name: "تأخير" })[0].click());

    await waitFor(() => expect(dashMutate).toHaveBeenCalledTimes(2));
    const paths = dashMutate.mock.calls.map((c) => c[0]);
    expect(paths).toEqual(["/reels/1/", "/reels/2/"]);
    const orders = dashMutate.mock.calls.map((c) => (c[2] as { order: number }).order);
    expect(new Set(orders).size).toBe(2);
  });

  it("puts the rail back and says so when a reorder fails", async () => {
    dashMutate.mockRejectedValue(new Error("boom"));
    render(<ReelsManager reels={[reel({ id: 1, title: "الأول" }), reel({ id: 2, title: "الثاني" })]} />);

    await act(async () => screen.getAllByRole("button", { name: "تأخير" })[0].click());

    expect(await screen.findByRole("alert")).toHaveTextContent("تعذّر إعادة الترتيب.");
    const titles = screen.getAllByRole("link").map((a) => a.textContent);
    expect(titles).toHaveLength(2);
  });

  it("cannot walk a reel off either end of the rail", () => {
    render(<ReelsManager reels={[reel({ id: 1 }), reel({ id: 2 })]} />);

    expect(screen.getAllByRole("button", { name: "تقديم" })[0]).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "تأخير" })[1]).toBeDisabled();
  });

  it("asks before deleting, and restores the card if the delete fails", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    dashMutate.mockRejectedValue(new Error("boom"));
    render(<ReelsManager reels={[reel({ title: "لقطة من المؤتمر" })]} />);

    await act(async () => screen.getByRole("button", { name: "مسح" }).click());

    expect(await screen.findByRole("alert")).toHaveTextContent("تعذّر حذف الريل.");
    expect(screen.getByText("لقطة من المؤتمر")).toBeInTheDocument();
  });

  it("leaves the shelf alone when the delete is waved off", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ReelsManager reels={[reel()]} />);

    await act(async () => screen.getByRole("button", { name: "مسح" }).click());

    expect(dashMutate).not.toHaveBeenCalled();
    expect(screen.getByText("1 ريل")).toBeInTheDocument();
  });

  it("says the shelf is empty rather than rendering a bare grid", () => {
    render(<ReelsManager reels={[]} />);

    expect(screen.getByText("لا توجد ريلز بعد")).toBeInTheDocument();
  });

  it("right-aligns the modal actions in their own row, cancel then save", async () => {
    render(<ReelsManager reels={[]} />);
    await act(async () => screen.getByRole("button", { name: /إضافة ريل/ }).click());

    const save = screen.getByRole("button", { name: "حفظ" });
    const cancel = screen.getByRole("button", { name: "إلغاء" });
    const row = save.parentElement;

    expect(row).toBe(cancel.parentElement);
    expect(row!.className).toContain("flex");
    expect(row!.className).toContain("justify-end");
  });

  it("gives the save button a visible focus ring", async () => {
    render(<ReelsManager reels={[]} />);
    await act(async () => screen.getByRole("button", { name: /إضافة ريل/ }).click());

    expect(screen.getByRole("button", { name: "حفظ" }).className).toContain("focus-visible:ring");
  });
});
