import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ArticleEditorForm from "./ArticleEditorForm";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const dashMutate = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    dashMutate: (...args: unknown[]) => dashMutate(...args),
    apiMutate: vi.fn(),
    getMediaAssets: vi.fn().mockResolvedValue({ results: [] }),
    dashUpload: vi.fn(),
  };
});
vi.mock("@/lib/revalidate", () => ({ revalidateSite: vi.fn().mockResolvedValue(undefined) }));

const sections = [
  { id: 1, key: "egypt", label: "شؤون مصر" },
  { id: 2, key: "opinion", label: "بالعقل والمنطق" },
];

const authors = [
  { id: 42, username: "mahir", name: "ماهر فرغلي", title: "كاتب سياسي", avatar: "/media/avatars/mahir.png" },
  { id: 15, username: "s.farouk", name: "سامية فاروق", title: "", avatar: null },
];

const setup = (props = {}) =>
  render(<ArticleEditorForm initial={null} sections={sections} authors={authors} {...props} />);

const authorSelect = () => screen.getByLabelText("الكاتب المسجّل") as HTMLSelectElement;
const bylineInput = () => screen.getByLabelText("اسم الكاتب") as HTMLInputElement;

/**
 * The link between an article and a real author account.
 *
 * This is the field the opinion page's byline block, portrait and profile
 * link are all built on — and until it existed the editor offered only a free
 * text byline, which is why the client had been typing names by hand and
 * uploading the writer's face into the COVER image slot.
 *
 * The two fields must stay mutually exclusive. An article carrying a linked
 * author AND a leftover byline string is precisely the state that hid a
 * columnist's photo on every card in production (see
 * backend/content/tests_author_avatar.py), so the editor must not be able to
 * produce it by accident.
 */
describe("ArticleEditorForm — linking a registered author", () => {
  it("lists every author account, with their professional title", () => {
    setup();

    expect(screen.getByRole("option", { name: /ماهر فرغلي — كاتب سياسي/ })).toBeInTheDocument();
    // No title on file: the name stands alone rather than trailing a dash.
    expect(screen.getByRole("option", { name: "سامية فاروق" })).toBeInTheDocument();
  });

  it("offers an explicit 'no account' choice, selected by default", () => {
    setup();

    expect(authorSelect().value).toBe("");
    expect(screen.getByRole("option", { name: /بدون/ })).toBeInTheDocument();
  });

  it("pre-selects the author an existing article is already linked to", () => {
    setup({
      articleId: 7,
      initial: {
        id: 7,
        title: "عنوان",
        slug: "s",
        kind: "opinion",
        section: null,
        subcategory: "",
        country: "",
        author: { id: 42, username: "mahir", name: "ماهر فرغلي", name_en: "", initial: "م", bio: "", title: "كاتب سياسي", avatar: null, is_hidden: false, article_count: 1, opinion_count: 1, date_joined: "" },
        byline: "",
        tags: [],
        language: "ar",
        related_article: null,
        status: "draft",
        badge: "none",
        pinned: false,
        notify_urgent: false,
        notify_label: "",
        standfirst: "",
        cover_image: null,
        cover_image_width: null,
        cover_image_height: null,
        cover_caption: "",
        cover_credit: "",
        views: 0,
        read_minutes: 1,
        tts_status: "idle",
        tts_audio: null,
        tts_duration_seconds: 0,
        published_at: null,
        scheduled_for: null,
        created_at: "",
        blocks: [],
        comments: [],
      },
    });

    expect(authorSelect().value).toBe("42");
  });

  it("clears a leftover manual byline when an account is picked", () => {
    setup();
    fireEvent.change(bylineInput(), { target: { value: "ماهر فرغلي" } });
    expect(bylineInput().value).toBe("ماهر فرغلي");

    fireEvent.change(authorSelect(), { target: { value: "42" } });

    // The exact state that suppressed the avatar in production.
    expect(bylineInput().value).toBe("");
    expect(authorSelect().value).toBe("42");
  });

  it("clears the linked account when a manual byline is typed", () => {
    setup();
    fireEvent.change(authorSelect(), { target: { value: "42" } });

    fireEvent.change(bylineInput(), { target: { value: "فريق التحرير" } });

    expect(authorSelect().value).toBe("");
    expect(bylineInput().value).toBe("فريق التحرير");
  });

  it("does not clear the account when the byline is only whitespace", () => {
    // Blanking the field must not be read as "the editor wants a byline".
    setup();
    fireEvent.change(authorSelect(), { target: { value: "42" } });

    fireEvent.change(bylineInput(), { target: { value: "   " } });

    expect(authorSelect().value).toBe("42");
  });

  it("replaces the cover field for an opinion piece by a photographed author", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "بالعقل والمنطق" }));
    fireEvent.change(authorSelect(), { target: { value: "42" } });

    // The cover slot is the one the client had been misusing for the face.
    expect(screen.getByText(/غير مستخدمة لمقالات الرأي/)).toBeInTheDocument();
    expect(screen.queryByText("🖼 اختيار من مكتبة الصور")).not.toBeInTheDocument();
  });

  it("keeps the cover field when the linked author has no photo", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "بالعقل والمنطق" }));
    fireEvent.change(authorSelect(), { target: { value: "15" } });

    expect(screen.getByText("🖼 اختيار من مكتبة الصور")).toBeInTheDocument();
  });

  it("keeps the cover field on a news article even with a photographed author", () => {
    // News stories genuinely need a cover — the substitution is opinion-only.
    setup();
    fireEvent.click(screen.getByRole("button", { name: "شؤون مصر" }));
    fireEvent.change(authorSelect(), { target: { value: "42" } });

    expect(screen.getByText("🖼 اختيار من مكتبة الصور")).toBeInTheDocument();
  });

  it("renders without an authors list at all", () => {
    // The prop defaults to [] so an older call site cannot crash the editor.
    render(<ArticleEditorForm initial={null} sections={sections} />);

    expect(authorSelect()).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /بدون/ })).toBeInTheDocument();
  });
});
