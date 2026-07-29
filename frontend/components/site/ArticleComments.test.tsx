import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ArticleComments from "./ArticleComments";
import type { ArticleComment } from "@/lib/types";

const apiMutate = vi.fn();
vi.mock("@/lib/api", async () => {
  const real = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...real, apiMutate: (...a: unknown[]) => apiMutate(...a) };
});

const initial: ArticleComment[] = [
  { id: 1, user_name: "منى", text: "تعليق معتمد", created_at: "2026-07-01T10:00:00Z" },
];

const send = async (text: string, name = "") => {
  if (name) fireEvent.change(screen.getByPlaceholderText("اسمك (اختياري)"), { target: { value: name } });
  fireEvent.change(screen.getByPlaceholderText("اكتب تعليقك…"), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "إرسال" }));
  });
};

afterEach(() => apiMutate.mockReset());

describe("ArticleComments", () => {
  it("lists the approved conversation", () => {
    render(<ArticleComments lang="ar" articleId={7} initial={initial} />);

    expect(screen.getByRole("heading", { name: "التعليقات (1)" })).toBeInTheDocument();
    expect(screen.getByText("تعليق معتمد")).toBeInTheDocument();
  });

  it("invites rather than counts when there is nothing yet", () => {
    render(<ArticleComments lang="ar" articleId={7} initial={[]} />);

    expect(screen.getByRole("heading", { name: "شارك برأيك" })).toBeInTheDocument();
    expect(screen.getByText(/كن أول من يعلّق/)).toBeInTheDocument();
  });

  it("submits to the moderation queue and says so — it does NOT paint the comment in", async () => {
    apiMutate.mockResolvedValue({ id: 9 });
    render(<ArticleComments lang="ar" articleId={7} initial={initial} />);

    await send("رأيي كذا", "أحمد");

    expect(apiMutate).toHaveBeenCalledWith("/comments/", "POST", {
      article: 7,
      user_name: "أحمد",
      text: "رأيي كذا",
    });
    // Honest UX: موجود في الطابور، مش في القائمة.
    expect(await screen.findByRole("status")).toHaveTextContent("سيظهر هنا بعد موافقة فريق التحرير");
    expect(screen.queryByText("رأيي كذا")).not.toBeInTheDocument();
    // The form is gone — a second box under a "received" notice invites spam.
    expect(screen.queryByPlaceholderText("اكتب تعليقك…")).not.toBeInTheDocument();
  });

  it("falls back to «قارئ» when the reader leaves the name empty", async () => {
    apiMutate.mockResolvedValue({ id: 9 });
    render(<ArticleComments lang="ar" articleId={7} initial={[]} />);

    await send("بدون اسم");

    expect(apiMutate).toHaveBeenCalledWith("/comments/", "POST", expect.objectContaining({ user_name: "قارئ" }));
  });

  it("keeps the draft and reports the failure when the queue is unreachable", async () => {
    apiMutate.mockRejectedValue(new Error("network"));
    render(<ArticleComments lang="ar" articleId={7} initial={[]} />);

    await send("تعليق مهم");

    expect(await screen.findByRole("alert")).toHaveTextContent("تعذّر إرسال التعليق");
    // The reader's words survive the failure — nothing is more hostile than
    // a form that eats a paragraph.
    expect(screen.getByPlaceholderText("اكتب تعليقك…")).toHaveValue("تعليق مهم");
  });

  it("refuses to send whitespace", async () => {
    render(<ArticleComments lang="ar" articleId={7} initial={[]} />);

    fireEvent.change(screen.getByPlaceholderText("اكتب تعليقك…"), { target: { value: "   " } });

    expect(screen.getByRole("button", { name: "إرسال" })).toBeDisabled();
    expect(apiMutate).not.toHaveBeenCalled();
  });

  it("blocks a double submit while the first is in flight", async () => {
    let release: (v: unknown) => void = () => {};
    apiMutate.mockReturnValue(new Promise((r) => (release = r)));
    render(<ArticleComments lang="ar" articleId={7} initial={[]} />);

    await send("مرة واحدة");
    expect(screen.getByRole("button", { name: "لحظة…" })).toBeDisabled();

    await act(async () => release({ id: 9 }));
    await waitFor(() => expect(apiMutate).toHaveBeenCalledTimes(1));
  });

  it("speaks English on the English edition", async () => {
    apiMutate.mockResolvedValue({ id: 9 });
    render(<ArticleComments lang="en" articleId={7} initial={[]} />);

    fireEvent.change(screen.getByPlaceholderText("Write a comment…"), { target: { value: "Nice piece" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
    });

    expect(apiMutate).toHaveBeenCalledWith("/comments/", "POST", expect.objectContaining({ user_name: "Reader" }));
    expect(await screen.findByRole("status")).toHaveTextContent("once the desk approves it");
  });
});
