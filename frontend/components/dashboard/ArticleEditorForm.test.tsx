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

describe("ArticleEditorForm scheduling", () => {
  afterEach(() => {
    push.mockClear();
    refresh.mockClear();
    dashMutate.mockReset();
  });

  const fillTitle = () =>
    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر مجدول" } });

  const setTime = (value: string) =>
    fireEvent.change(screen.getByLabelText(/جدولة النشر/), { target: { value } });

  it("keeps the schedule button hidden until a time is picked", () => {
    render(<ArticleEditorForm initial={null} sections={sections} />);

    expect(screen.queryByText("⏰ جدولة النشر")).not.toBeInTheDocument();

    setTime("2030-01-01T09:00");

    expect(screen.getByText("⏰ جدولة النشر")).toBeInTheDocument();
  });

  it("saves as scheduled with the chosen moment in ISO", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "sched" });
    render(<ArticleEditorForm initial={null} sections={sections} />);
    fillTitle();
    setTime("2030-01-01T09:00");

    await act(async () => {
      fireEvent.click(screen.getByText("⏰ جدولة النشر"));
    });

    const [, , payload] = dashMutate.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(payload.status).toBe("scheduled");
    expect(payload.scheduled_for).toBe(new Date("2030-01-01T09:00").toISOString());
  });

  it("refuses a moment in the past, with the reason named", async () => {
    render(<ArticleEditorForm initial={null} sections={sections} />);
    fillTitle();
    setTime("2020-01-01T09:00");

    await act(async () => {
      fireEvent.click(screen.getByText("⏰ جدولة النشر"));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("وقت الجدولة لازم يكون في المستقبل");
    expect(dashMutate).not.toHaveBeenCalled();
  });

  it("publishing normally clears any lingering schedule", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);
    fillTitle();
    setTime("2030-01-01T09:00");

    await act(async () => {
      fireEvent.click(screen.getByText("حفظ ونشر"));
    });

    const [, , payload] = dashMutate.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(payload.status).toBe("published");
    // «مجدول ٩:٠٠» must not linger on a story someone published by hand.
    expect(payload.scheduled_for).toBeNull();
  });
});

describe("ArticleEditorForm byline", () => {
  afterEach(() => {
    push.mockClear();
    refresh.mockClear();
    dashMutate.mockReset();
  });

  it("saves with an empty byline when nothing is typed — the field is optional", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);
    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر بلا كاتب" } });

    await act(async () => fireEvent.click(screen.getByText("حفظ ونشر")));

    const [, , payload] = dashMutate.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(payload.byline).toBe("");
  });

  it("saves whatever name was typed, with no list to pick from", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);
    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "بيان صادر" } });
    fireEvent.change(screen.getByLabelText("اسم الكاتب"), { target: { value: "فريق التحرير" } });

    await act(async () => fireEvent.click(screen.getByText("حفظ ونشر")));

    const [, , payload] = dashMutate.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(payload.byline).toBe("فريق التحرير");
  });
});

describe("ArticleEditorForm paragraph alignment", () => {
  afterEach(() => {
    push.mockClear();
    refresh.mockClear();
    dashMutate.mockReset();
  });

  it("defaults a new paragraph to right — the same default an unstyled RTL paragraph already reads as", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);
    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر بلا محاذاة مخصصة" } });

    await act(async () => fireEvent.click(screen.getByText("حفظ ونشر")));

    const [, , payload] = dashMutate.mock.calls[0] as [string, string, { blocks: { align: string }[] }];
    expect(payload.blocks[0].align).toBe("right");
  });

  it("opens the alignment menu, offers all four options, and saves the one picked", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);
    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر مضبوط النص" } });

    fireEvent.click(screen.getByLabelText("محاذاة الفقرة"));
    expect(screen.getByText("محاذاة اليسار")).toBeInTheDocument();
    expect(screen.getByText("محاذاة الوسط")).toBeInTheDocument();
    expect(screen.getByText("ضبط")).toBeInTheDocument();

    fireEvent.click(screen.getByText("ضبط"));
    // Picking an option closes the menu — it's a one-shot choice, not a toggle.
    expect(screen.queryByText("محاذاة اليسار")).not.toBeInTheDocument();

    await act(async () => fireEvent.click(screen.getByText("حفظ ونشر")));

    const [, , payload] = dashMutate.mock.calls[0] as [string, string, { blocks: { align: string }[] }];
    expect(payload.blocks[0].align).toBe("justify");
  });
});

describe("ArticleEditorForm review", () => {
  afterEach(() => {
    push.mockClear();
    refresh.mockClear();
    dashMutate.mockReset();
  });

  it("sends the article to the review queue instead of publishing or archiving it", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);
    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر جاهز للمراجعة" } });

    await act(async () => fireEvent.click(screen.getByText("إرسال للمراجعة")));

    const [, , payload] = dashMutate.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(payload.status).toBe("review");
    expect(push).toHaveBeenCalledWith("/dashboard/articles");
  });

  it("still requires a title, same as the other save paths", async () => {
    render(<ArticleEditorForm initial={null} sections={sections} />);

    fireEvent.click(screen.getByText("إرسال للمراجعة"));

    expect(await screen.findByRole("alert")).toHaveTextContent("لازم تكتب عنوان الخبر أولاً");
    expect(dashMutate).not.toHaveBeenCalled();
  });
});
