import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { DASHBOARD } from "@/lib/routes";
import { afterEach, describe, expect, it, vi } from "vitest";

import ArticleEditorForm from "./ArticleEditorForm";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const dashMutate = vi.fn();
const apiMutate = vi.fn();
const getMediaAssets = vi.fn();
const dashUpload = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    dashMutate: (...args: unknown[]) => dashMutate(...args),
    apiMutate: (...args: unknown[]) => apiMutate(...args),
    getMediaAssets: (...args: unknown[]) => getMediaAssets(...args),
    dashUpload: (...args: unknown[]) => dashUpload(...args),
  };
});
const revalidateSite = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/revalidate", () => ({ revalidateSite: (...args: unknown[]) => revalidateSite(...args) }));

const pngFile = (name = "IMG_20260512.png") => new File(["x"], name, { type: "image/png" });

const sections = [{ id: 1, key: "egypt", label: "شؤون مصر" }];

/** Selects `text` inside `el` by locating it in the (already-rendered) DOM —
 *  same approach RichTextEditor.test.tsx uses for its own fields. */
function selectWord(el: HTMLElement, word: string) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const at = (node.textContent ?? "").indexOf(word);
    if (at !== -1) {
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + word.length);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    node = walker.nextNode();
  }
  throw new Error(`"${word}" not found`);
}

/** Every non-draft save now requires real body content — types one
 *  paragraph into the default starter block, the same way an editor
 *  filling out the form for real would before hitting «حفظ ونشر». */
const fillBody = (text = "فقرة أولى في المتن") => {
  const field = screen.getByRole("textbox", { name: "نص الفقرة" });
  field.textContent = text;
  fireEvent.input(field);
};

describe("ArticleEditorForm save feedback", () => {
  afterEach(() => {
    push.mockClear();
    refresh.mockClear();
    dashMutate.mockReset();
    revalidateSite.mockClear();
  });

  /**
   * Regression: the public home page holds its render for up to a minute
   * (revalidate=60) — a story published just now didn't show up there
   * until that window happened to lapse on its own, which read as "the
   * publish didn't really work." revalidateSite existed in lib/revalidate.ts
   * but nothing ever called it.
   */
  it("busts the public site's cache after a successful save", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);
    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر تجريبي" } });
    fillBody();

    await act(async () => fireEvent.click(screen.getByText("حفظ ونشر")));

    expect(revalidateSite).toHaveBeenCalled();
  });

  it("does not bust the cache when the save fails", async () => {
    const { ApiError } = await import("@/lib/api");
    dashMutate.mockRejectedValue(new ApiError("/articles/", 400, "Bad Request", {}));
    render(<ArticleEditorForm initial={null} sections={sections} />);
    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر تجريبي" } });
    fillBody();

    await act(async () => fireEvent.click(screen.getByText("حفظ ونشر")));

    expect(revalidateSite).not.toHaveBeenCalled();
  });

  /**
   * Regression: deleting (or never filling in) the editor's one starter
   * block and hitting «حفظ ونشر» sent `blocks: [{text: ""}]` — a title with
   * nothing behind it went live on the public site. A draft is allowed to
   * be an empty shell; anything that actually publishes is not.
   */
  it("blocks publishing with no real content in any block", async () => {
    render(<ArticleEditorForm initial={null} sections={sections} />);
    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "عنوان بلا متن" } });

    fireEvent.click(screen.getByText("حفظ ونشر"));

    expect(await screen.findByRole("alert")).toHaveTextContent("الخبر لسه من غير محتوى");
    expect(dashMutate).not.toHaveBeenCalled();
  });

  it("still allows saving an empty draft — a stub an editor comes back to later", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);
    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "عنوان فقط، لسه بدون متن" } });

    await act(async () => fireEvent.click(screen.getByText("حفظ كأرشفة")));

    expect(dashMutate).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
    fillBody();
    await act(async () => {
      fireEvent.click(screen.getByText("حفظ ونشر"));
    });

    // ?saved=1 is what tells the articles list to show the confirmation
    // banner — see ArticlesTable's justSaved prop.
    expect(push).toHaveBeenCalledWith(`${DASHBOARD}/articles?saved=1`);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("surfaces the server's validation message instead of failing silently", async () => {
    const { ApiError } = await import("@/lib/api");
    dashMutate.mockRejectedValue(new ApiError("/articles/", 400, "Bad Request", { section: ["This field is required."] }));
    render(<ArticleEditorForm initial={null} sections={sections} />);

    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر تجريبي" } });
    fillBody();
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
    fillBody();
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
    fillBody();
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
    fillBody();

    await act(async () => fireEvent.click(screen.getByText("حفظ ونشر")));

    const [, , payload] = dashMutate.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(payload.byline).toBe("");
  });

  it("saves whatever name was typed, with no list to pick from", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);
    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "بيان صادر" } });
    fireEvent.change(screen.getByLabelText("اسم الكاتب"), { target: { value: "فريق التحرير" } });
    fillBody();

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

  it("defaults a new paragraph to justify — consistent line lengths instead of a ragged edge", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);
    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر بلا محاذاة مخصصة" } });
    fillBody();

    await act(async () => fireEvent.click(screen.getByText("حفظ ونشر")));

    const [, , payload] = dashMutate.mock.calls[0] as [string, string, { blocks: { align: string }[] }];
    expect(payload.blocks[0].align).toBe("justify");
  });

  it("opens the alignment menu, offers all four options, and saves the one picked", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);
    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر مضبوط النص" } });
    fillBody();

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
    expect(push).toHaveBeenCalledWith(`${DASHBOARD}/articles?saved=1`);
  });

  it("still requires a title, same as the other save paths", async () => {
    render(<ArticleEditorForm initial={null} sections={sections} />);

    fireEvent.click(screen.getByText("إرسال للمراجعة"));

    expect(await screen.findByRole("alert")).toHaveTextContent("لازم تكتب عنوان الخبر أولاً");
    expect(dashMutate).not.toHaveBeenCalled();
  });
});

describe("ArticleEditorForm import from URL", () => {
  afterEach(() => {
    push.mockClear();
    refresh.mockClear();
    dashMutate.mockReset();
    apiMutate.mockReset();
  });

  it("offers the import box only when creating a new article", () => {
    render(<ArticleEditorForm initial={null} sections={sections} />);
    expect(screen.getByText("استيراد خبر من رابط")).toBeInTheDocument();
  });

  it("hides the import box when editing an existing article", () => {
    const initial = {
      id: 9, title: "خبر", slug: "x", kind: "news", section: null, subcategory: "", country: "",
      author: null, byline: "", tags: [], language: "ar", related_article: null, status: "draft",
      badge: "none", pinned: false, standfirst: "", cover_image: null, cover_caption: "", cover_credit: "",
      views: 0, read_minutes: 1, tts_status: "idle", tts_audio: null, tts_duration_seconds: 0,
      published_at: null, scheduled_for: null, created_at: "", blocks: [], comments: [],
    } as never;

    render(<ArticleEditorForm initial={initial} articleId={9} sections={sections} />);

    expect(screen.queryByText("استيراد خبر من رابط")).not.toBeInTheDocument();
  });

  it("loads an imported draft's fields into the form, ready to review and save", async () => {
    apiMutate.mockResolvedValue({
      title: "عنوان من الاستيراد",
      standfirst: "مقدمة من الاستيراد",
      paragraphs: ["الفقرة الأولى المستوردة.", "الفقرة الثانية المستوردة."],
      byline: "منقول عن example.com",
      cover_asset_id: null,
      cover_image: null,
    });
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);

    fireEvent.change(screen.getByLabelText("رابط الخبر"), { target: { value: "https://example.com/news/1" } });
    await act(async () => fireEvent.click(screen.getByText("استيراد")));

    expect(screen.getByPlaceholderText("عنوان الخبر")).toHaveValue("عنوان من الاستيراد");
    expect(screen.getByLabelText("اسم الكاتب")).toHaveValue("منقول عن example.com");
    expect(screen.getByText("الفقرة الأولى المستوردة. الفقرة الثانية المستوردة.")).toBeInTheDocument();

    await act(async () => fireEvent.click(screen.getByText("حفظ كأرشفة")));

    const [, , payload] = dashMutate.mock.calls[0] as [string, string, { blocks: { text: string }[] }];
    expect(payload.blocks.map((b) => b.text)).toEqual(["الفقرة الأولى المستوردة. الفقرة الثانية المستوردة."]);
  });
});

describe("ArticleEditorForm inline image", () => {
  afterEach(() => {
    dashMutate.mockReset();
    getMediaAssets.mockReset();
    vi.useRealTimers();
  });

  it("«🖼 صورة من المكتبة» inserts the picked asset into the block's own text, not its dedicated image field", async () => {
    vi.useFakeTimers();
    getMediaAssets.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 5,
          image: "library/x.jpg",
          title: "صورة مختارة",
          alt: "",
          credit: "",
          license: "owned",
          license_label: "",
          source: "",
          article: null,
          article_title: null,
          article_slug: null,
          created_at: "",
        },
      ],
    });
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);

    fireEvent.click(screen.getByText("🖼 صورة من المكتبة"));
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.click(screen.getByText("صورة مختارة"));

    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر" } });
    await act(async () => fireEvent.click(screen.getByText("حفظ كأرشفة")));

    const [, , payload] = dashMutate.mock.calls[0] as [string, string, { blocks: { text: string; image: unknown }[] }];
    expect(payload.blocks[0].text).toBe("{img:library/x.jpg}");
  });
});

describe("ArticleEditorForm paste splits into blocks", () => {
  afterEach(() => {
    dashMutate.mockReset();
  });

  /**
   * Regression: pasting a multi-paragraph article (the normal write-in-
   * Word-then-paste workflow) used to land the whole thing, breaks and all,
   * inside the one paragraph block that was focused — every paragraph
   * still there as text, but as a single block instead of one per
   * paragraph, undoing the client's own vertical formatting until someone
   * clicked «✂ تقسيم» by hand after every line.
   */
  it("turns a multi-paragraph paste (blank-line separated) into one block per paragraph", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);

    const field = screen.getByRole("textbox", { name: "نص الفقرة" });
    field.focus();
    fireEvent.paste(field, {
      clipboardData: { getData: (type: string) => (type === "text/plain" ? "فقرة أولى\n\nفقرة ثانية\n\nفقرة ثالثة" : "") },
    });

    expect(screen.getAllByRole("textbox", { name: "نص الفقرة" })).toHaveLength(3);

    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر" } });
    await act(async () => fireEvent.click(screen.getByText("حفظ كأرشفة")));

    const [, , payload] = dashMutate.mock.calls[0] as [string, string, { blocks: { text: string; type: string }[] }];
    expect(payload.blocks.map((b) => b.text)).toEqual(["فقرة أولى", "فقرة ثانية", "فقرة ثالثة"]);
    expect(payload.blocks.every((b) => b.type === "paragraph")).toBe(true);
  });

  it("keeps a single-newline paste (no blank line) as one block — regression: WhatsApp-composed text, one sentence per line with no blank lines, exploded into a block per line", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);

    const field = screen.getByRole("textbox", { name: "نص الفقرة" });
    field.focus();
    fireEvent.paste(field, {
      clipboardData: { getData: (type: string) => (type === "text/plain" ? "سطر أول\nسطر ثاني\nسطر ثالث" : "") },
    });

    expect(screen.getAllByRole("textbox", { name: "نص الفقرة" })).toHaveLength(1);

    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر" } });
    await act(async () => fireEvent.click(screen.getByText("حفظ كأرشفة")));

    const [, , payload] = dashMutate.mock.calls[0] as [string, string, { blocks: { text: string }[] }];
    expect(payload.blocks.map((b) => b.text)).toEqual(["سطر أول\nسطر ثاني\nسطر ثالث"]);
  });

  it("a single-line paste still lands in the one block, unaffected", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);

    const field = screen.getByRole("textbox", { name: "نص الفقرة" });
    field.focus();
    fireEvent.paste(field, { clipboardData: { getData: (type: string) => (type === "text/plain" ? "خبر عاجل اليوم" : "") } });

    expect(screen.getAllByRole("textbox", { name: "نص الفقرة" })).toHaveLength(1);
    expect(field.textContent).toBe("خبر عاجل اليوم");
  });
});

describe("ArticleEditorForm image uploads require a name", () => {
  afterEach(() => {
    dashMutate.mockReset();
    dashUpload.mockReset();
    vi.unstubAllGlobals();
  });

  it("prompts for a name and uploads under it, not the camera's own filename", async () => {
    const prompt = vi.fn().mockReturnValue("اجتماع مجلس الوزراء");
    vi.stubGlobal("prompt", prompt);
    dashUpload.mockResolvedValue({ id: 7, image: "library/uploaded.jpg", credit: "" });
    render(<ArticleEditorForm initial={null} sections={sections} />);

    fireEvent.click(screen.getByText("⬆ صورة داخل المقال"));
    fireEvent.change(screen.getByLabelText("رفع صورة داخل النص من الجهاز"), { target: { files: [pngFile()] } });
    await act(async () => {});

    expect(prompt).toHaveBeenCalledWith("اسم الصورة (يساعد على ترتيب المكتبة والبحث عنها لاحقاً):", "IMG_20260512");
    const form = dashUpload.mock.calls[0][2] as FormData;
    expect(form.get("title")).toBe("اجتماع مجلس الوزراء");
  });

  it("inserts the uploaded image's path into the block's text at the captured cursor", async () => {
    vi.stubGlobal("prompt", vi.fn().mockReturnValue("اسم"));
    dashUpload.mockResolvedValue({ id: 7, image: "library/uploaded.jpg", credit: "" });
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);

    fireEvent.click(screen.getByText("⬆ صورة داخل المقال"));
    fireEvent.change(screen.getByLabelText("رفع صورة داخل النص من الجهاز"), { target: { files: [pngFile()] } });
    await act(async () => {});

    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر" } });
    await act(async () => fireEvent.click(screen.getByText("حفظ كأرشفة")));

    const [, , payload] = dashMutate.mock.calls[0] as [string, string, { blocks: { text: string }[] }];
    expect(payload.blocks[0].text).toBe("{img:library/uploaded.jpg}");
  });

  it("cancelling the name prompt aborts the upload entirely", async () => {
    vi.stubGlobal("prompt", vi.fn().mockReturnValue(null));
    render(<ArticleEditorForm initial={null} sections={sections} />);

    fireEvent.click(screen.getByText("⬆ صورة داخل المقال"));
    fireEvent.change(screen.getByLabelText("رفع صورة داخل النص من الجهاز"), { target: { files: [pngFile()] } });
    await act(async () => {});

    expect(dashUpload).not.toHaveBeenCalled();
  });

  it("prompts for a name when uploading a cover image straight from the device", async () => {
    const prompt = vi.fn().mockReturnValue("غلاف الخبر");
    vi.stubGlobal("prompt", prompt);
    dashUpload.mockResolvedValue({ id: 8, image: "library/cover.jpg", credit: "" });
    render(<ArticleEditorForm initial={null} sections={sections} />);

    fireEvent.change(screen.getByLabelText("رفع صورة الغلاف من الجهاز"), { target: { files: [pngFile("cover.png")] } });
    await act(async () => {});

    expect(prompt).toHaveBeenCalled();
    const form = dashUpload.mock.calls[0][2] as FormData;
    expect(form.get("title")).toBe("غلاف الخبر");
  });
});

describe("ArticleEditorForm urgent notification", () => {
  afterEach(() => {
    dashMutate.mockReset();
  });

  const checkbox = () => within(screen.getByText("إشعار عاجل").closest("label")!).getByRole("checkbox");

  it("saves unchecked by default, with no subtitle field shown", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);

    expect(screen.queryByPlaceholderText("يحدث الآن")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر عادي" } });
    fillBody();
    await act(async () => {
      fireEvent.click(screen.getByText("حفظ ونشر"));
    });

    const payload = dashMutate.mock.calls[0][2];
    expect(payload.notify_urgent).toBe(false);
  });

  it("reveals the subtitle field once checked, and saves both", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);

    fireEvent.click(checkbox());
    const subtitle = screen.getByPlaceholderText("يحدث الآن");
    fireEvent.change(subtitle, { target: { value: "تحديث هام" } });

    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "زلزال يضرب المنطقة" } });
    fillBody();
    await act(async () => {
      fireEvent.click(screen.getByText("حفظ ونشر"));
    });

    const payload = dashMutate.mock.calls[0][2];
    expect(payload.notify_urgent).toBe(true);
    expect(payload.notify_label).toBe("تحديث هام");
  });

  it("falls back to a default subtitle when the field is cleared", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);

    fireEvent.click(checkbox());
    fireEvent.change(screen.getByPlaceholderText("يحدث الآن"), { target: { value: "  " } });
    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر" } });
    fillBody();
    await act(async () => {
      fireEvent.click(screen.getByText("حفظ ونشر"));
    });

    expect(dashMutate.mock.calls[0][2].notify_label).toBe("خبر عاجل");
  });

  it("loads an already-urgent article with its checkbox and subtitle pre-filled", () => {
    render(
      <ArticleEditorForm
        initial={{ id: 3, notify_urgent: true, notify_label: "يحدث الآن", blocks: [], tags: [] } as any}
        sections={sections}
      />,
    );

    expect(checkbox()).toBeChecked();
    expect(screen.getByPlaceholderText("يحدث الآن")).toHaveValue("يحدث الآن");
  });
});

describe("ArticleEditorForm TTS narration", () => {
  afterEach(() => {
    dashMutate.mockReset();
  });

  const savedArticle = (over: Record<string, unknown> = {}) =>
    ({
      id: 9, title: "خبر", slug: "x", kind: "news", section: null, subcategory: "", country: "",
      author: null, byline: "", tags: [], language: "ar", related_article: null, status: "published",
      badge: "none", pinned: false, notify_urgent: false, notify_label: "خبر عاجل", standfirst: "",
      cover_image: null, cover_caption: "", cover_credit: "",
      views: 0, read_minutes: 1, tts_status: "idle", tts_audio: null, tts_duration_seconds: 0,
      published_at: null, scheduled_for: null, created_at: "", blocks: [], comments: [],
      ...over,
    }) as never;

  it("asks to save the article first when there is no id yet", () => {
    render(<ArticleEditorForm initial={null} sections={sections} />);

    expect(screen.getByText(/احفظ المقال أولاً/)).toBeInTheDocument();
    expect(screen.queryByText("🎙 توليد النسخة الصوتية")).not.toBeInTheDocument();
  });

  it("calls the real generation endpoint and shows the actual duration returned, not a hardcoded one", async () => {
    dashMutate.mockResolvedValue({ tts_status: "done", tts_duration_seconds: 137 });
    render(<ArticleEditorForm initial={savedArticle()} articleId={9} sections={sections} />);

    await act(async () => {
      fireEvent.click(screen.getByText("🎙 توليد النسخة الصوتية"));
    });

    expect(dashMutate).toHaveBeenCalledWith("/articles/9/generate_tts/", "POST");
    expect(screen.getByText("✓ تم التوليد — 2:17")).toBeInTheDocument();
  });

  it("reports a real failure instead of quietly showing done", async () => {
    const { ApiError } = await import("@/lib/api");
    dashMutate.mockRejectedValue(new ApiError("/articles/9/generate_tts/", 422, "Unprocessable", { detail: "لا يوجد نص كافٍ" }));
    render(<ArticleEditorForm initial={savedArticle()} articleId={9} sections={sections} />);

    await act(async () => {
      fireEvent.click(screen.getByText("🎙 توليد النسخة الصوتية"));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("لا يوجد نص كافٍ");
    expect(screen.getByText("🎙 توليد النسخة الصوتية")).toBeInTheDocument();
  });
});

describe("ArticleEditorForm auto-narrates on publish", () => {
  afterEach(() => {
    dashMutate.mockReset();
  });

  /**
   * Regression: «سماع الخبر» stayed silent on every article the newsroom
   * actually published, because generating its narration was a second,
   * easy-to-forget manual step (the 🎙 button above) — publishing itself
   * never triggered it. Publishing now fires it in the background, same
   * spirit as the public-site cache-bust that already happens on save.
   */
  it("fires the narration endpoint after a new article is published, without being asked to", async () => {
    dashMutate.mockResolvedValueOnce({ id: 41, slug: "test" }); // the POST /articles/ itself
    dashMutate.mockResolvedValueOnce({}); // generate_tts, fired in the background
    render(<ArticleEditorForm initial={null} sections={sections} />);
    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر جديد" } });
    fillBody();

    await act(async () => fireEvent.click(screen.getByText("حفظ ونشر")));

    expect(dashMutate).toHaveBeenCalledWith("/articles/41/generate_tts/", "POST");
  });

  it("does not fire narration for a draft or a review save — only an actual publish", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);
    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر" } });

    await act(async () => fireEvent.click(screen.getByText("حفظ كأرشفة")));

    expect(dashMutate).not.toHaveBeenCalledWith(expect.stringContaining("generate_tts"), "POST");
  });

  it("a narration call that itself fails must not be reported as the save failing", async () => {
    dashMutate.mockResolvedValueOnce({ id: 41, slug: "test" });
    dashMutate.mockRejectedValueOnce(new Error("voice engine down"));
    render(<ArticleEditorForm initial={null} sections={sections} />);
    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر جديد" } });
    fillBody();

    await act(async () => fireEvent.click(screen.getByText("حفظ ونشر")));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(push).toHaveBeenCalledWith(`${DASHBOARD}/articles?saved=1`);
  });
});

describe("ArticleEditorForm homepage pin", () => {
  afterEach(() => {
    dashMutate.mockReset();
  });

  const pinCheckbox = () => within(screen.getByText("الظهور في الرئيسية").closest("label")!).getByRole("checkbox");

  it("saves unpinned by default", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);

    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر" } });
    fillBody();
    await act(async () => {
      fireEvent.click(screen.getByText("حفظ ونشر"));
    });

    expect(dashMutate.mock.calls[0][2].pinned).toBe(false);
  });

  it("checking it sends pinned:true", async () => {
    dashMutate.mockResolvedValue({ id: 9, slug: "test" });
    render(<ArticleEditorForm initial={null} sections={sections} />);

    fireEvent.click(pinCheckbox());
    fireEvent.change(screen.getByPlaceholderText("عنوان الخبر"), { target: { value: "خبر مثبّت" } });
    fillBody();
    await act(async () => {
      fireEvent.click(screen.getByText("حفظ ونشر"));
    });

    expect(dashMutate.mock.calls[0][2].pinned).toBe(true);
  });

  it("loads an already-pinned article with the checkbox pre-checked", () => {
    render(
      <ArticleEditorForm
        initial={{ id: 3, pinned: true, blocks: [], tags: [] } as any}
        sections={sections}
      />,
    );

    expect(pinCheckbox()).toBeChecked();
  });
});

describe("ArticleEditorForm unified body — one static toolbar for every paragraph", () => {
  afterEach(() => {
    dashMutate.mockReset();
  });

  it("the shared toolbar formats whichever paragraph is actually focused, not always the first one", async () => {
    render(<ArticleEditorForm initial={null} sections={sections} />);

    const first = screen.getByRole("textbox", { name: "نص الفقرة" });
    first.textContent = "فقرة واحدة";
    fireEvent.input(first);

    // «+ المحتوى» inserts after whichever block is active — right after the
    // one just typed into, same as a word processor's "new paragraph here".
    fireEvent.click(screen.getByText("+ المحتوى"));
    const fields = screen.getAllByRole("textbox", { name: "نص الفقرة" });
    expect(fields).toHaveLength(2);

    const second = fields[1];
    second.textContent = "فقرة ثانية";
    fireEvent.input(second);
    second.focus();
    fireEvent.focus(second);
    selectWord(second, "ثانية");

    fireEvent.click(screen.getByLabelText("نص غامق"));

    expect(within(second).getByText("ثانية")).toHaveStyle({ fontWeight: "700" });
    // The first field is untouched — the shared toolbar acted only on the
    // paragraph that was focused.
    expect(first.querySelector("b, strong")).toBeNull();
  });

  it("disables the shared formatting tools while a non-text block (a subheading) is focused", () => {
    render(<ArticleEditorForm initial={null} sections={sections} />);

    fireEvent.click(screen.getByText("+ عنوان فرعي"));
    fireEvent.focus(screen.getByPlaceholderText("نص العنوان الفرعي"));

    expect(screen.getByLabelText("نص غامق")).toBeDisabled();
    expect(screen.getByTitle("إضافة صورة من المكتبة عند موضع المؤشر في الفقرة النشطة")).toBeDisabled();
  });

  it("does not wrap each paragraph in its own bordered card — one shared container for the whole body", () => {
    render(<ArticleEditorForm initial={null} sections={sections} />);

    fireEvent.click(screen.getByText("+ المحتوى"));
    fireEvent.click(screen.getByText("+ المحتوى"));

    const fields = screen.getAllByRole("textbox", { name: "نص الفقرة" });
    expect(fields).toHaveLength(3);
    // Each field's own immediate wrapper carries no border of its own —
    // the border lives once, on the shared container around all of them.
    fields.forEach((f) => expect(f.className).not.toMatch(/border/));
  });

  it("shows no repeated «المحتوى» label and no divider between paragraphs — a blank flowing canvas, not a stack of labelled cards", () => {
    render(<ArticleEditorForm initial={null} sections={sections} />);

    fireEvent.click(screen.getByText("+ المحتوى"));
    fireEvent.click(screen.getByText("+ المحتوى"));
    expect(screen.getAllByRole("textbox", { name: "نص الفقرة" })).toHaveLength(3);

    // The type label used to sit above every single block; it must not be
    // visible text anywhere in the body now.
    expect(screen.queryByText("المحتوى")).not.toBeInTheDocument();
    // No horizontal-rule/divider utility classes anywhere in the body — the
    // paragraphs must never look like separated stacked cards.
    expect(document.querySelector(".divide-y")).toBeNull();
  });
});
