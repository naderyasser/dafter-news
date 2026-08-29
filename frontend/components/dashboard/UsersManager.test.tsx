import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import UsersManager from "./UsersManager";
import type { DashUser } from "@/lib/types";

const dashMutate = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, dashMutate: (...args: unknown[]) => dashMutate(...args) };
});

const users: DashUser[] = [
  { id: 1, username: "m.eladawy", name: "محمد العدوي", email: "m@aldaftarnews.com", role: "editor", last_login: null, is_active: true, date_joined: "2026-01-01", must_change_password: true, is_staff: true },
];

describe("UsersManager", () => {
  afterEach(() => dashMutate.mockReset());

  it("creates a user and hands over the credentials once", async () => {
    dashMutate.mockResolvedValue({ id: 2, username: "new.user", name: "مستخدم جديد", email: "new@aldaftarnews.com", role: "author", last_login: null, is_active: true, date_joined: "2026-01-01", must_change_password: true, is_staff: true, temporary_password: "Temp-Pass-99" });
    render(<UsersManager users={users} />);

    fireEvent.click(screen.getByText("+ مستخدم جديد"));
    fireEvent.change(screen.getByLabelText("الاسم الكامل"), { target: { value: "مستخدم جديد" } });
    fireEvent.change(screen.getByLabelText("البريد الإلكتروني"), { target: { value: "new@aldaftarnews.com" } });
    await act(async () => {
      fireEvent.click(screen.getByText("إنشاء الحساب"));
    });

    // The password exists in readable form exactly once — here — so the
    // drawer stays open on the hand-over card instead of closing on a toast.
    expect(screen.getByText("✓ تم إنشاء حساب «مستخدم جديد»")).toBeInTheDocument();
    expect(screen.getByText("Temp-Pass-99")).toBeInTheDocument();
    // Twice now — once in the new table row, once on the hand-over card.
    expect(screen.getAllByText("new@aldaftarnews.com").length).toBeGreaterThan(0);
  });

  it("sends the admin's chosen password when one is typed", async () => {
    dashMutate.mockResolvedValue({ id: 3, username: "x", name: "س", email: "s@x.com", role: "author", last_login: null, is_active: true, date_joined: "2026-01-01", must_change_password: true, is_staff: true, temporary_password: "chosen-one" });
    render(<UsersManager users={users} />);

    fireEvent.click(screen.getByText("+ مستخدم جديد"));
    fireEvent.change(screen.getByLabelText("الاسم الكامل"), { target: { value: "سارة" } });
    fireEvent.change(screen.getByLabelText("البريد الإلكتروني"), { target: { value: "s@x.com" } });
    fireEvent.change(screen.getByLabelText(/كلمة مرور مؤقتة/), { target: { value: "chosen-one" } });
    await act(async () => {
      fireEvent.click(screen.getByText("إنشاء الحساب"));
    });

    expect(dashMutate.mock.calls[0][2]).toMatchObject({ password: "chosen-one", role: "author" });
  });

  it("offers deactivation beside deletion, and says the articles survive", async () => {
    render(<UsersManager users={users} />);

    // Deactivating is the reversible move; it is offered first for that reason.
    expect(screen.getAllByTitle(/إيقاف الدخول مع بقاء المقالات/).length).toBeGreaterThan(0);
    expect(screen.getAllByTitle(/حذف نهائي — المقالات تبقى/).length).toBeGreaterThan(0);
  });

  it("can grant dashboard access to a byline-only writer", async () => {
    // Every seeded writer is a columnist row with real articles and no
    // dashboard access; creating a second account for them would orphan the
    // archive, so the grant has to happen on the row itself.
    const columnist = { ...users[0], id: 9, name: "سامية فاروق", is_staff: false };
    dashMutate.mockResolvedValue({ ...columnist, is_staff: true });
    render(<UsersManager users={[columnist]} />);

    await act(async () => {
      fireEvent.click(screen.getByTitle(/لا يدخل اللوحة/));
    });

    expect(dashMutate.mock.calls[0][2]).toMatchObject({ is_staff: true });
  });

  it("does not delete without confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<UsersManager users={users} />);

    await act(async () => {
      fireEvent.click(screen.getAllByTitle(/حذف نهائي/)[0]);
    });

    expect(dashMutate).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("does not fabricate an account when the create request fails", async () => {
    dashMutate.mockRejectedValue(new Error("network"));
    render(<UsersManager users={users} />);

    fireEvent.click(screen.getByText("+ مستخدم جديد"));
    fireEvent.change(screen.getByLabelText("الاسم الكامل"), { target: { value: "مستخدم وهمي" } });
    fireEvent.change(screen.getByLabelText("البريد الإلكتروني"), { target: { value: "fake@aldaftarnews.com" } });
    await act(async () => {
      fireEvent.click(screen.getByText("إنشاء الحساب"));
    });

    expect(screen.queryByText("مستخدم وهمي")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/تم حفظ المستخدم بنجاح/)).not.toBeInTheDocument();
  });

  it("opens the edit drawer pre-filled and PATCHes the existing user instead of creating a new one", async () => {
    dashMutate.mockResolvedValue({ ...users[0], name: "محمد العدوي المصري" });
    render(<UsersManager users={users} />);

    fireEvent.click(screen.getByTitle("تعديل"));
    expect(screen.getByDisplayValue("محمد العدوي")).toBeInTheDocument();
    expect(screen.getByText("تعديل المستخدم")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("الاسم الكامل"), { target: { value: "محمد العدوي المصري" } });
    await act(async () => {
      fireEvent.click(screen.getByText("حفظ التعديلات"));
    });

    expect(dashMutate).toHaveBeenCalledWith("/users/1/", "PATCH", expect.any(Object));
    // Still one row — nothing was duplicated.
    const rows = screen.getAllByText(/محمد العدوي/);
    expect(rows).toHaveLength(1);
  });

  it("blocks saving with an empty name or email", async () => {
    render(<UsersManager users={users} />);

    fireEvent.click(screen.getByText("+ مستخدم جديد"));
    fireEvent.click(screen.getByText("إنشاء الحساب"));

    expect(screen.getByRole("alert")).toHaveTextContent("الاسم والبريد الإلكتروني مطلوبان");
    expect(dashMutate).not.toHaveBeenCalled();
  });
});
