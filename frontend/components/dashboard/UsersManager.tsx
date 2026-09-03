"use client";

import { useState } from "react";

import StatusBadge from "@/components/dashboard/StatusBadge";
import { dashMutate, describeApiError } from "@/lib/api";
import type { DashUser, Role } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { AR_LOCALE } from "@/lib/format";

const ROLES: { key: Role; label: string }[] = (Object.keys(ROLE_LABELS) as Role[]).map((key) => ({ key, label: ROLE_LABELS[key] }));

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
  // Optional: the admin may type a password instead of letting the API mint
  // one. Either way the account is forced to replace it at first login.
  const [password, setPassword] = useState("");
  // The credential to read out, shown once after an invite and never again —
  // the API returns it in the create response and stores only the hash.
  const [issued, setIssued] = useState<{ name: string; email: string; password: string } | null>(null);

  const openNew = () => {
    setEditingId(null);
    setName("");
    setEmail("");
    setRole("author");
    setPassword("");
    setIssued(null);
    setError("");
    setDrawerOpen(true);
  };

  const openEdit = (u: DashUser) => {
    setEditingId(u.id);
    setPassword("");
    setIssued(null);
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
        const payload = {
          username: email.split("@")[0] || name.trim().replace(/\s+/g, "."),
          first_name: first || "",
          last_name: rest.join(" "),
          email,
          role,
          password: password.trim(),
        };
        const created = await dashMutate<DashUser & { temporary_password: string }>("/users/", "POST", payload);
        setUsers((us) => [created, ...us]);
        // Hold the drawer open on the hand-over card instead of closing: this
        // is the only moment the password exists in readable form, and an
        // admin who closes the drawer expecting to find it later cannot.
        setIssued({ name: name.trim(), email, password: created.temporary_password });
        setToastText("✓ تم إنشاء الحساب");
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 2500);
        setSaving(false);
        return;
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

  const setDashboardAccess = async (u: DashUser, grant: boolean) => {
    // Separate from «إيقاف»: is_active is "is this account switched on",
    // is_staff is "does it open the dashboard". Every seeded writer on this
    // site is a byline-only row (is_staff=false) with real articles behind
    // it, so granting access has to be possible without creating a second
    // account and orphaning their archive.
    try {
      const updated = await dashMutate<DashUser>(`/users/${u.id}/`, "PATCH", { is_staff: grant });
      setUsers((us) => us.map((x) => (x.id === u.id ? updated : x)));
      setToastText(grant ? "✓ تم منح دخول لوحة التحكم" : "✓ تم سحب دخول لوحة التحكم");
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 2500);
    } catch (err) {
      setError(describeApiError(err, "تعذّر تغيير صلاحية الدخول."));
    }
  };

  const setActive = async (u: DashUser, active: boolean) => {
    try {
      const updated = await dashMutate<DashUser>(`/users/${u.id}/`, "PATCH", { is_active: active });
      setUsers((us) => us.map((x) => (x.id === u.id ? updated : x)));
      setToastText(active ? "✓ تم تفعيل الحساب" : "✓ تم إيقاف الحساب");
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 2500);
    } catch (err) {
      setError(describeApiError(err, "تعذّر تغيير حالة الحساب."));
    }
  };

  const remove = async (u: DashUser) => {
    // Deactivating is the reversible move and the one offered first; deletion
    // is spelled out because it cannot be undone. What it does NOT do is
    // touch their stories — the API stamps their name onto each article's
    // byline before the row goes (see UserViewSet.perform_destroy).
    const ok = window.confirm(
      `حذف حساب «${u.name}» نهائياً؟\n\nمقالاته المنشورة ستبقى على الموقع باسمه.\nإذا كنت تريد منعه من الدخول فقط، استخدم «إيقاف» بدلاً من الحذف.`,
    );
    if (!ok) return;
    try {
      await dashMutate(`/users/${u.id}/`, "DELETE");
      setUsers((us) => us.filter((x) => x.id !== u.id));
      setToastText("✓ تم حذف الحساب — مقالاته باقية باسمه");
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 2500);
    } catch (err) {
      setError(describeApiError(err, "تعذّر حذف الحساب."));
    }
  };

  return (
    <>
      {error && !drawerOpen ? (
        <div role="alert" className="rounded-card border border-down bg-down-tint px-3.5 py-2.5 text-[13.5px] font-semibold text-down">
          {error}
        </div>
      ) : null}
      <div className="flex justify-end">
        <button onClick={openNew} className="rounded-lg bg-brand px-4.5 py-2.5 text-[14px] font-bold text-paper hover:bg-brand-strong">
          + مستخدم جديد
        </button>
      </div>
      <div className="overflow-x-auto rounded-card border border-line bg-paper">
        <div className="grid min-w-[800px] grid-cols-[1.5fr_1.7fr_.9fr_.9fr_.8fr_130px] bg-surface">
          <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">الاسم</div>
          <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">البريد الإلكتروني</div>
          <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">الدور</div>
          <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">آخر دخول</div>
          <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">الحالة</div>
          <div />
        </div>
        {users.map((u) => (
          <div
            key={u.id}
            className={`grid min-h-[48px] min-w-[800px] grid-cols-[1.5fr_1.7fr_.9fr_.9fr_.8fr_130px] items-center border-t border-line ${
              u.is_active ? "" : "bg-surface/60"
            }`}
          >
            <div className="px-3.5 text-[14.5px] font-semibold text-ink">
              {u.name}
              {u.must_change_password && (
                <span className="ms-2 rounded-badge bg-gold/15 px-1.5 py-0.5 text-[11px] font-bold text-gold" title="لم يغيّر كلمة المرور المؤقتة بعد">
                  بانتظار أول دخول
                </span>
              )}
            </div>
            <div dir="ltr" className="px-3.5 text-end text-[14.5px] text-ink-3">
              {u.email}
            </div>
            <div className="px-3.5">
              <StatusBadge status={u.role} />
            </div>
            <div className="px-3.5 text-[14.5px] text-ink-3">{u.last_login ? new Date(u.last_login).toLocaleDateString(AR_LOCALE) : "—"}</div>
            <div className="px-3.5">
              {u.is_active ? (
                <span className="text-[13px] font-bold text-up">نشط</span>
              ) : (
                <span className="text-[13px] font-bold text-ink-3">موقوف</span>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 pe-3.5">
              <button onClick={() => openEdit(u)} className="cursor-pointer text-[15px] text-ink-3 hover:text-accent" title="تعديل">
                ✎
              </button>
              <button
                onClick={() => setDashboardAccess(u, !u.is_staff)}
                className={`rounded-md border px-2 py-1 text-[12px] font-semibold ${
                  u.is_staff ? "border-accent text-accent" : "border-line text-ink-3 hover:border-accent hover:text-accent"
                }`}
                title={u.is_staff ? "يدخل لوحة التحكم — اضغط للسحب" : "لا يدخل اللوحة — اضغط لمنح الدخول"}
              >
                {u.is_staff ? "له دخول" : "منح دخول"}
              </button>
              <button
                onClick={() => setActive(u, !u.is_active)}
                className="rounded-md border border-line px-2 py-1 text-[12px] font-semibold text-ink-2 hover:border-accent hover:text-accent"
                title={u.is_active ? "إيقاف الدخول مع بقاء المقالات" : "إعادة تفعيل الحساب"}
              >
                {u.is_active ? "إيقاف" : "تفعيل"}
              </button>
              <button
                onClick={() => remove(u)}
                className="rounded-md border border-line px-2 py-1 text-[12px] font-semibold text-ink-3 hover:border-down hover:text-down"
                title="حذف نهائي — المقالات تبقى"
              >
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>

      {drawerOpen && (
        <>
          <div onClick={() => setDrawerOpen(false)} className="fixed inset-0 z-[60] bg-[rgba(23,26,31,.4)]" />
          <div className="fixed inset-y-0 end-0 z-[61] flex w-[360px] max-w-[92vw] flex-col gap-3.5 bg-paper p-6 shadow-2">
            <div className="flex items-center justify-between">
              <span className="text-[17px] font-extrabold">
                {issued ? "بيانات الدخول" : editingId ? "تعديل المستخدم" : "مستخدم جديد"}
              </span>
              <span onClick={() => setDrawerOpen(false)} className="cursor-pointer text-[18px] text-ink-3">
                ✕
              </span>
            </div>
            {error ? (
              <div role="alert" className="rounded-card border border-down bg-down-tint px-3.5 py-2.5 text-[13.5px] font-semibold text-down">
                {error}
              </div>
            ) : null}
            {issued ? (
              <div className="flex flex-col gap-3.5">
                <div className="rounded-card border border-up bg-up-tint px-4 py-3 text-[13.5px] font-semibold text-up">
                  ✓ تم إنشاء حساب «{issued.name}»
                </div>
                <p className="m-0 text-[13.5px] leading-[1.7] text-ink-2">
                  سلّم هذه البيانات للمستخدم. <strong>لن تظهر كلمة المرور مرة أخرى</strong> بعد إغلاق هذه النافذة —
                  إن ضاعت، أنشئ كلمة مرور جديدة من زر التعديل.
                </p>
                <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
                  <div className="text-[12.5px] font-bold text-ink-3">البريد الإلكتروني</div>
                  <div dir="ltr" className="select-all text-end text-[14.5px] font-semibold text-ink">{issued.email}</div>
                  <div className="mt-2 text-[12.5px] font-bold text-ink-3">كلمة المرور المؤقتة</div>
                  <div dir="ltr" className="select-all text-end font-mono text-[17px] font-bold tracking-wider text-ink">
                    {issued.password}
                  </div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(`${issued.email}\n${issued.password}`)
                      .then(() => setToastText("✓ تم نسخ البيانات"))
                      .catch(() => setToastText("انسخ البيانات يدوياً"))
                      .finally(() => {
                        setToastVisible(true);
                        setTimeout(() => setToastVisible(false), 2500);
                      });
                  }}
                  className="rounded-lg border border-line py-2.5 text-[14px] font-bold text-ink hover:border-brand hover:text-brand"
                >
                  نسخ البريد وكلمة المرور
                </button>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="mt-auto rounded-lg bg-brand py-3 text-[15px] font-bold text-paper hover:bg-brand-strong"
                >
                  تم — أغلق
                </button>
              </div>
            ) : (
            <>
            <label htmlFor="user-name" className="text-[14px] font-semibold text-ink-2">
              الاسم الكامل
            </label>
            <input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-line px-3 py-2.5 text-[14.5px] outline-none focus:border-brand"
            />
            <label htmlFor="user-email" className="text-[14px] font-semibold text-ink-2">
              البريد الإلكتروني
            </label>
            <input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-line px-3 py-2.5 text-[14.5px] outline-none focus:border-brand"
            />
            {!editingId && (
              <>
                <label htmlFor="user-password" className="text-[14px] font-semibold text-ink-2">
                  كلمة مرور مؤقتة <span className="font-normal text-ink-3">(اختياري)</span>
                </label>
                <input
                  id="user-password"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="اتركها فارغة لتوليد كلمة مرور قوية"
                  className="rounded-lg border border-line px-3 py-2.5 text-[14.5px] outline-none focus:border-brand"
                />
                <p className="m-0 text-[12.5px] leading-[1.6] text-ink-3">
                  ستظهر كلمة المرور مرة واحدة بعد الحفظ لتسليمها للمستخدم، وسيُطلب منه تغييرها عند أول دخول.
                </p>
              </>
            )}
            <label className="text-[14px] font-semibold text-ink-2">الدور</label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRole(r.key)}
                  className={`rounded-pill border px-3.5 py-1.5 text-[13.5px] font-semibold ${role === r.key ? "border-brand bg-brand text-paper" : "border-line bg-paper text-ink"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button onClick={save} disabled={saving} className="mt-auto rounded-lg bg-brand py-3 text-[15px] font-bold text-paper hover:bg-brand-strong disabled:opacity-60">
              {saving ? "جارِ الحفظ..." : editingId ? "حفظ التعديلات" : "إنشاء الحساب"}
            </button>
            </>
            )}
          </div>
        </>
      )}

      {toastVisible && (
        <div className="fixed top-5 end-6 z-[70] rounded-lg bg-ink px-5 py-3 text-[14.5px] font-semibold text-paper shadow-2">{toastText}</div>
      )}
    </>
  );
}
