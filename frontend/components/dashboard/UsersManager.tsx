"use client";

import { useState } from "react";

import StatusBadge from "@/components/dashboard/StatusBadge";
import { dashMutate, describeApiError } from "@/lib/api";
import type { DashUser, Role } from "@/lib/types";

const ROLES: { key: Role; label: string }[] = [
  { key: "admin", label: "مدير" },
  { key: "editor", label: "محرر" },
  { key: "author", label: "كاتب" },
  { key: "moderator", label: "مشرف تعليقات" },
];

export default function UsersManager({ users: initial }: { users: DashUser[] }) {
  const [users, setUsers] = useState(initial);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastText, setToastText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // Set while the drawer is editing an existing row rather than creating a
  // new one — the pencil icon used to reopen this same blank form, so
  // saving from it created a second account instead of editing the first.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("author");

  const openNew = () => {
    setEditingId(null);
    setName("");
    setEmail("");
    setRole("author");
    setError("");
    setDrawerOpen(true);
  };

  const openEdit = (u: DashUser) => {
    setEditingId(u.id);
    setName(u.name);
    setEmail(u.email);
    setRole(u.role);
    setError("");
    setDrawerOpen(true);
  };

  const save = async () => {
    setError("");
    if (!name.trim() || !email.trim()) {
      setError("الاسم والبريد الإلكتروني مطلوبان.");
      return;
    }
    setSaving(true);
    const [first, ...rest] = name.trim().split(" ");
    try {
      if (editingId) {
        const updated = await dashMutate<DashUser>(`/users/${editingId}/`, "PATCH", {
          first_name: first || "",
          last_name: rest.join(" "),
          email,
          role,
        });
        setUsers((us) => us.map((u) => (u.id === editingId ? updated : u)));
        setToastText("✓ تم تحديث المستخدم بنجاح");
      } else {
        const payload = { username: email.split("@")[0] || name.trim().replace(/\s+/g, "."), first_name: first || "", last_name: rest.join(" "), email, role };
        const created = await dashMutate<DashUser>("/users/", "POST", payload);
        setUsers((us) => [created, ...us]);
        setToastText("✓ تم حفظ المستخدم بنجاح");
      }
      setDrawerOpen(false);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 2500);
    } catch (err) {
      // A save that silently fails here is worse than most: the admin walks
      // away believing an account with real access exists when it never did.
      setError(describeApiError(err, "تعذّر حفظ المستخدم. حاول مرة أخرى."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex justify-end">
        <button onClick={openNew} className="rounded-lg bg-brand px-4.5 py-2.5 text-[13px] font-bold text-paper hover:bg-brand-strong">
          + مستخدم جديد
        </button>
      </div>
      <div className="overflow-hidden rounded-card border border-line bg-paper">
        <div className="grid grid-cols-[1.6fr_1.8fr_1fr_1fr_80px] bg-surface">
          <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">الاسم</div>
          <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">البريد الإلكتروني</div>
          <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">الدور</div>
          <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">آخر دخول</div>
          <div />
        </div>
        {users.map((u) => (
          <div key={u.id} className="grid min-h-[48px] grid-cols-[1.6fr_1.8fr_1fr_1fr_80px] items-center border-t border-line">
            <div className="px-3.5 text-[13.5px] font-semibold text-ink">{u.name}</div>
            <div dir="ltr" className="px-3.5 text-end text-[13.5px] text-ink-3">
              {u.email}
            </div>
            <div className="px-3.5">
              <StatusBadge status={u.role} />
            </div>
            <div className="px-3.5 text-[13.5px] text-ink-3">{u.last_login ? new Date(u.last_login).toLocaleDateString("ar-EG") : "—"}</div>
            <div className="pe-3.5">
              <span onClick={() => openEdit(u)} className="cursor-pointer text-ink-3" title="تعديل">
                ✎
              </span>
            </div>
          </div>
        ))}
      </div>

      {drawerOpen && (
        <>
          <div onClick={() => setDrawerOpen(false)} className="fixed inset-0 z-[60] bg-[rgba(23,26,31,.4)]" />
          <div className="fixed inset-y-0 end-0 z-[61] flex w-[360px] max-w-[92vw] flex-col gap-3.5 bg-paper p-6 shadow-2">
            <div className="flex items-center justify-between">
              <span className="text-[17px] font-extrabold">{editingId ? "تعديل المستخدم" : "مستخدم جديد"}</span>
              <span onClick={() => setDrawerOpen(false)} className="cursor-pointer text-[18px] text-ink-3">
                ✕
              </span>
            </div>
            {error ? (
              <div role="alert" className="rounded-card border border-down bg-down-tint px-3.5 py-2.5 text-[12.5px] font-semibold text-down">
                {error}
              </div>
            ) : null}
            <label htmlFor="user-name" className="text-[13px] font-semibold text-ink-2">
              الاسم الكامل
            </label>
            <input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-line px-3 py-2.5 text-[13.5px] outline-none focus:border-brand"
            />
            <label htmlFor="user-email" className="text-[13px] font-semibold text-ink-2">
              البريد الإلكتروني
            </label>
            <input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-line px-3 py-2.5 text-[13.5px] outline-none focus:border-brand"
            />
            <label className="text-[13px] font-semibold text-ink-2">الدور</label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRole(r.key)}
                  className={`rounded-pill border px-3.5 py-1.5 text-[12.5px] font-semibold ${role === r.key ? "border-brand bg-brand text-paper" : "border-line bg-paper text-ink"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button onClick={save} disabled={saving} className="mt-auto rounded-lg bg-brand py-3 text-[14px] font-bold text-paper hover:bg-brand-strong disabled:opacity-60">
              {saving ? "جارِ الحفظ..." : editingId ? "حفظ التعديلات" : "حفظ المستخدم"}
            </button>
          </div>
        </>
      )}

      {toastVisible && (
        <div className="fixed top-5 end-6 z-[70] rounded-lg bg-ink px-5 py-3 text-[13.5px] font-semibold text-paper shadow-2">{toastText}</div>
      )}
    </>
  );
}
