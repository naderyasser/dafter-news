import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ColumnistsManager from "./ColumnistsManager";
import type { Author } from "@/lib/types";

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

const baseAuthor: Author = {
  id: 1,
  username: "existing",
  name: "كاتب موجود",
  name_en: "Existing Author",
  initial: "ك",
  bio: "",
  title: "",
  avatar: null,
  is_hidden: false,
  article_count: 0,
  opinion_count: 0,
  date_joined: "2026-01-01",
};

const file = () => new File(["x"], "avatar.png", { type: "image/png" });

describe("ColumnistsManager avatar-upload failures", () => {
  afterEach(() => {
    dashMutate.mockReset();
    dashUpload.mockReset();
  });

  it("still shows the new author when the create succeeds but the avatar upload fails", async () => {
    const created: Author = { ...baseAuthor, id: 2, username: "new.author", name: "كاتب جديد" };
    dashMutate.mockResolvedValue(created);
    dashUpload.mockRejectedValue(new Error("invalid image"));

    const { container } = render(<ColumnistsManager authors={[]} articles={[]} />);

    fireEvent.click(screen.getByText("+ كاتب جديد"));
    fireEvent.change(screen.getByLabelText("اسم المستخدم"), { target: { value: "new.author" } });
    fireEvent.change(screen.getByLabelText("الاسم الأول"), { target: { value: "كاتب" } });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file()] } });

    await act(async () => {
      fireEvent.click(screen.getByText("حفظ"));
    });

    // The author row was created server-side and must not vanish just
    // because the second request (the avatar) failed.
    expect(screen.getByText("كاتب جديد")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("أُضيف الكاتب لكن تعذّر رفع صورته");
    // Must not show the generic (and here wrong) duplicate-username message.
    expect(screen.queryByText(/غير مكرر/)).not.toBeInTheDocument();
  });

  it("keeps a failed create out of local state and shows the duplicate-username message", async () => {
    dashMutate.mockRejectedValue(new Error("400"));
    render(<ColumnistsManager authors={[]} articles={[]} />);

    fireEvent.click(screen.getByText("+ كاتب جديد"));
    fireEvent.change(screen.getByLabelText("اسم المستخدم"), { target: { value: "dup.author" } });
    fireEvent.change(screen.getByLabelText("الاسم الأول"), { target: { value: "كاتب" } });

    await act(async () => {
      fireEvent.click(screen.getByText("حفظ"));
    });

    expect(screen.queryByText("كاتب")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("تأكد أن اسم المستخدم غير مكرر");
  });

  it("keeps the successful text edit even when the avatar upload fails", async () => {
    const saved: Author = { ...baseAuthor, name: "اسم محدّث" };
    dashMutate.mockResolvedValue(saved);
    dashUpload.mockRejectedValue(new Error("invalid image"));

    const { container } = render(<ColumnistsManager authors={[baseAuthor]} articles={[]} />);

    fireEvent.click(screen.getByText("تعديل"));
    fireEvent.change(screen.getByLabelText("الاسم الأول"), { target: { value: "اسم" } });
    fireEvent.change(screen.getByLabelText("اسم العائلة"), { target: { value: "محدّث" } });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file()] } });

    await act(async () => {
      fireEvent.click(screen.getByText("حفظ"));
    });

    // The PATCH already landed server-side — the on-screen card must reflect
    // it instead of the stale pre-edit name.
    expect(screen.getByText("اسم محدّث")).toBeInTheDocument();
    expect(screen.queryByText("كاتب موجود")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("حُفظت بيانات الكاتب لكن تعذّر رفع صورته");
  });
});
