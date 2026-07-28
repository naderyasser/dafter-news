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
  { id: 1, username: "m.eladawy", name: "محمد العدوي", email: "m@aldaftarnews.com", role: "editor", last_login: null, is_active: true, date_joined: "2026-01-01" },
];

describe("UsersManager", () => {
  afterEach(() => dashMutate.mockReset());

  it("creates a user and shows a confirmation toast", async () => {
    dashMutate.mockResolvedValue({ id: 2, username: "new.user", name: "مستخدم جديد", email: "new@aldaftarnews.com", role: "author", last_login: null, is_active: true, date_joined: "2026-01-01" });
    render(<UsersManager users={users} />);

    fireEvent.click(screen.getByText("+ مستخدم جديد"));
    fireEvent.change(screen.getByLabelText("الاسم الكامل"), { target: { value: "مستخدم جديد" } });
    fireEvent.change(screen.getByLabelText("البريد الإلكتروني"), { target: { value: "new@aldaftarnews.com" } });
    await act(async () => {
      fireEvent.click(screen.getByText("حفظ المستخدم"));
    });

    expect(screen.getByText("مستخدم جديد")).toBeInTheDocument();
    expect(screen.getByText("✓ تم حفظ المستخدم بنجاح")).toBeInTheDocument();
  });

  it("does not fabricate an account when the create request fails", async () => {
    dashMutate.mockRejectedValue(new Error("network"));
    render(<UsersManager users={users} />);

    fireEvent.click(screen.getByText("+ مستخدم جديد"));
    fireEvent.change(screen.getByLabelText("الاسم الكامل"), { target: { value: "مستخدم وهمي" } });
    fireEvent.change(screen.getByLabelText("البريد الإلكتروني"), { target: { value: "fake@aldaftarnews.com" } });
    await act(async () => {
      fireEvent.click(screen.getByText("حفظ المستخدم"));
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
    fireEvent.click(screen.getByText("حفظ المستخدم"));

    expect(screen.getByRole("alert")).toHaveTextContent("الاسم والبريد الإلكتروني مطلوبان");
    expect(dashMutate).not.toHaveBeenCalled();
  });
});
