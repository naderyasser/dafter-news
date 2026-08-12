import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AiDraftGenerator from "./AiDraftGenerator";

const apiMutate = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, apiMutate: (...args: unknown[]) => apiMutate(...args) };
});

describe("AiDraftGenerator", () => {
  afterEach(() => apiMutate.mockReset());

  it("posts the topic and hands the draft back, shaped for the same applyImportedDraft path", async () => {
    apiMutate.mockResolvedValue({ title: "عنوان مقترح", standfirst: "مقدمة", paragraphs: ["فقرة أولى"] });
    const onGenerated = vi.fn();
    render(<AiDraftGenerator lang="ar" onGenerated={onGenerated} />);

    fireEvent.change(screen.getByLabelText("موضوع الخبر"), { target: { value: "قرار جديد لوزارة الكهرباء" } });
    await act(async () => fireEvent.click(screen.getByText("توليد")));

    expect(apiMutate).toHaveBeenCalledWith("/generate-draft/", "POST", {
      topic: "قرار جديد لوزارة الكهرباء",
      language: "ar",
    });
    expect(onGenerated).toHaveBeenCalledWith({
      title: "عنوان مقترح",
      standfirst: "مقدمة",
      paragraphs: ["فقرة أولى"],
      byline: "",
      cover_asset_id: null,
      cover_image: null,
    });
  });

  it("clears the field after a successful generation", async () => {
    apiMutate.mockResolvedValue({ title: "", standfirst: "", paragraphs: [] });
    render(<AiDraftGenerator lang="ar" onGenerated={vi.fn()} />);
    const field = screen.getByLabelText("موضوع الخبر") as HTMLTextAreaElement;

    fireEvent.change(field, { target: { value: "موضوع ما" } });
    await act(async () => fireEvent.click(screen.getByText("توليد")));

    expect(field.value).toBe("");
  });

  it("surfaces a failed generation instead of silently doing nothing", async () => {
    const { ApiError } = await import("@/lib/api");
    apiMutate.mockRejectedValue(
      new ApiError("/generate-draft/", 422, "Unprocessable", { detail: "لم يتم إعداد مفتاح الذكاء الاصطناعي." }),
    );
    render(<AiDraftGenerator lang="ar" onGenerated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("موضوع الخبر"), { target: { value: "موضوع ما" } });
    await act(async () => fireEvent.click(screen.getByText("توليد")));

    expect(await screen.findByRole("alert")).toHaveTextContent("لم يتم إعداد مفتاح الذكاء الاصطناعي.");
  });

  it("does nothing on an empty topic", async () => {
    render(<AiDraftGenerator lang="ar" onGenerated={vi.fn()} />);

    expect(screen.getByText("توليد")).toBeDisabled();
    expect(apiMutate).not.toHaveBeenCalled();
  });
});
