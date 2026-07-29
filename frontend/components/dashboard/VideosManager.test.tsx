import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import VideosManager from "./VideosManager";
import type { Section, Video } from "@/lib/types";

const dashMutate = vi.fn();
const dashUpload = vi.fn();
vi.mock("@/lib/api", () => ({
  dashMutate: (...a: unknown[]) => dashMutate(...a),
  dashUpload: (...a: unknown[]) => dashUpload(...a),
  mediaUrl: (p?: string | null) => p ?? undefined,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const video = (over: Partial<Video> = {}): Video => ({
  id: 1,
  title: "جولة داخل المصنع",
  slug: "factory-tour",
  section: 3,
  section_name: "علوم وتكنولوجيا",
  description: "",
  cover_image: "/media/c.jpg",
  file: null,
  external_url: "",
  duration_seconds: 440,
  duration_label: "07:20",
  is_live: false,
  is_exclusive: false,
  views: 12,
  comment_count: 3,
  created_at: "2026-07-01T00:00:00Z",
  ...over,
});

const sections: Section[] = [
  { id: 3, key: "tech", name_ar: "علوم وتكنولوجيا", name_en: "Science & Tech", order: 8 } as Section,
];

const openDialog = async () => {
  await act(async () => screen.getByRole("button", { name: /رفع فيديو جديد/ }).click());
};

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { selector: "input,textarea,select" }), { target: { value } });

afterEach(() => {
  dashMutate.mockReset();
  dashUpload.mockReset();
  vi.unstubAllGlobals();
});

describe("VideosManager — the grid", () => {
  it("counts what is there", () => {
    render(<VideosManager videos={[video()]} sections={sections} />);

    expect(screen.getByText("1 فيديو")).toBeInTheDocument();
  });

  it("says so plainly when there is nothing", () => {
    render(<VideosManager videos={[]} sections={sections} />);

    expect(screen.getByText("لا توجد فيديوهات بعد")).toBeInTheDocument();
  });

  it("opens each card on the video's own page", () => {
    render(<VideosManager videos={[video()]} sections={sections} />);

    expect(screen.getAllByRole("link", { name: /جولة داخل المصنع|/ })[0]).toHaveAttribute("href", "/video/factory-tour");
  });

  it.each(["مباشر", "خاص"] as const)("PATCHes only the %s flag it was asked to flip", async (label) => {
    dashMutate.mockResolvedValue({});
    render(<VideosManager videos={[video()]} sections={sections} />);

    await act(async () => screen.getByRole("button", { name: label }).click());

    const key = label === "مباشر" ? "is_live" : "is_exclusive";
    expect(dashMutate).toHaveBeenCalledTimes(1);
    expect(dashMutate).toHaveBeenCalledWith("/videos/1/", "PATCH", { [key]: true });
  });

  it("puts the flag back and says so when the PATCH fails", async () => {
    dashMutate.mockRejectedValue(new Error("network"));
    render(<VideosManager videos={[video()]} sections={sections} />);
    const chip = screen.getByRole("button", { name: "مباشر" });

    await act(async () => chip.click());

    // Optimism has to be reversible: an editor who sees «مباشر» stay lit
    // believes a stream is running that never started.
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("تعذّر تحديث الفيديو"));
    expect(screen.getByRole("button", { name: "مباشر" }).className).not.toContain("bg-badge-breaking");
  });

  it("asks before deleting, and does nothing at all if the answer is no", async () => {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    render(<VideosManager videos={[video()]} sections={sections} />);

    await act(async () => screen.getByRole("button", { name: "مسح" }).click());

    expect(dashMutate).not.toHaveBeenCalled();
    expect(screen.getByText("1 فيديو")).toBeInTheDocument();
  });

  it("restores a deleted row when the DELETE fails", async () => {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    dashMutate.mockRejectedValue(new Error("network"));
    render(<VideosManager videos={[video()]} sections={sections} />);

    await act(async () => screen.getByRole("button", { name: "مسح" }).click());

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("تعذّر حذف الفيديو"));
    expect(screen.getByText("1 فيديو")).toBeInTheDocument();
  });
});

describe("VideosManager — upload", () => {
  it("refuses to save a video with nothing to play", async () => {
    render(<VideosManager videos={[]} sections={sections} />);
    await openDialog();

    const save = screen.getByRole("button", { name: /رفع ونشر/ });
    expect(save).toBeDisabled();

    // A title alone is still nothing to play.
    type("العنوان", "عنوان");
    expect(save).toBeDisabled();

    // A source alone is still nothing to file it under.
    type("العنوان", "");
    fireEvent.change(screen.getByPlaceholderText(/رابط خارجي/), { target: { value: "https://youtu.be/x" } });
    expect(save).toBeDisabled();

    type("العنوان", "عنوان");
    expect(save).toBeEnabled();
  });

  it("rejects a title that is only whitespace", async () => {
    render(<VideosManager videos={[]} sections={sections} />);
    await openDialog();

    type("العنوان", "   ");
    fireEvent.change(screen.getByPlaceholderText(/رابط خارجي/), { target: { value: "https://youtu.be/x" } });

    expect(screen.getByRole("button", { name: /رفع ونشر/ })).toBeDisabled();
  });

  it("folds minutes and seconds into one duration and trims what it sends", async () => {
    dashUpload.mockResolvedValue(video({ id: 2, title: "جديد" }));
    render(<VideosManager videos={[]} sections={sections} />);
    await openDialog();

    type("العنوان", "  عنوان جديد  ");
    type("الوصف", "  وصف  ");
    fireEvent.change(screen.getByPlaceholderText(/رابط خارجي/), { target: { value: "  https://youtu.be/x  " } });
    fireEvent.change(screen.getByPlaceholderText("دقائق"), { target: { value: "7" } });
    fireEvent.change(screen.getByPlaceholderText("ثوانٍ"), { target: { value: "20" } });

    await act(async () => screen.getByRole("button", { name: /رفع ونشر/ }).click());

    const [path, method, form] = dashUpload.mock.calls[0] as [string, string, FormData];
    expect(path).toBe("/videos/");
    expect(method).toBe("POST");
    expect(form.get("title")).toBe("عنوان جديد");
    expect(form.get("description")).toBe("وصف");
    expect(form.get("duration_seconds")).toBe("440");
    expect(form.get("external_url")).toBe("https://youtu.be/x");
  });

  it("keeps digits-only in the duration fields", async () => {
    render(<VideosManager videos={[]} sections={sections} />);
    await openDialog();

    fireEvent.change(screen.getByPlaceholderText("دقائق"), { target: { value: "7m3" } });

    expect(screen.getByPlaceholderText("دقائق")).toHaveValue("73");
  });

  it("omits the section and the link entirely rather than sending empty ones", async () => {
    dashUpload.mockResolvedValue(video({ id: 2 }));
    render(<VideosManager videos={[]} sections={sections} />);
    await openDialog();

    type("العنوان", "عنوان");
    // File-only upload: no link typed at all.
    const fileInput = document.querySelector<HTMLInputElement>('input[accept="video/*"]')!;
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [new File(["x"], "clip.mp4", { type: "video/mp4" })] } });
    });

    await act(async () => screen.getByRole("button", { name: /رفع ونشر/ }).click());

    const form = dashUpload.mock.calls[0][2] as FormData;
    // A blank string here would have DRF write "" over the field rather than
    // leaving it unset.
    expect(form.has("external_url")).toBe(false);
    expect(form.has("section")).toBe(false);
    expect((form.get("file") as File).name).toBe("clip.mp4");
  });

  it("puts a newly uploaded video at the head of the grid", async () => {
    dashUpload.mockResolvedValue(video({ id: 2, title: "الأحدث", slug: "newest" }));
    render(<VideosManager videos={[video()]} sections={sections} />);
    await openDialog();

    type("العنوان", "الأحدث");
    fireEvent.change(screen.getByPlaceholderText(/رابط خارجي/), { target: { value: "https://youtu.be/x" } });
    await act(async () => screen.getByRole("button", { name: /رفع ونشر/ }).click());

    expect(screen.getByText("2 فيديو")).toBeInTheDocument();
    const titles = screen.getAllByText(/الأحدث|جولة داخل المصنع/);
    expect(titles[0]).toHaveTextContent("الأحدث");
  });

  it("closes the dialog and reports the failure when the upload is rejected", async () => {
    dashUpload.mockRejectedValue(new Error("413"));
    render(<VideosManager videos={[]} sections={sections} />);
    await openDialog();

    type("العنوان", "عنوان");
    fireEvent.change(screen.getByPlaceholderText(/رابط خارجي/), { target: { value: "https://youtu.be/x" } });
    await act(async () => screen.getByRole("button", { name: /رفع ونشر/ }).click());

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("تعذّر رفع الفيديو"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on the backdrop but not on a click inside the panel", async () => {
    render(<VideosManager videos={[]} sections={sections} />);
    await openDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole("dialog"));
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("presentation"));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
