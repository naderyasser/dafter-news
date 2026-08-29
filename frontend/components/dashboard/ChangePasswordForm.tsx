"use client";

import { useRouter } from "next/navigation";
import { DASHBOARD } from "@/lib/routes";
import { useState } from "react";

import { apiMutate, describeApiError } from "@/lib/api";

const FIELD =
  "w-full rounded-card border border-line bg-paper px-3.5 py-2.5 text-[14.5px] text-ink outline-none focus:border-accent";

/**
 * Replaces the caller's own password.
 *
 * `forced` is the first-login case: the copy explains why the screen appeared
 * uninvited, and there is no way past it except through it — the layout keeps
 * redirecting here until the flag clears. Without the explanation a new writer
 * reads it as the dashboard being broken.
 *
 * The current password is required even in the forced case: the account was
 * just used to log in, so the person typing has it, and requiring it means a
 * borrowed session can't quietly change the password out from under someone.
 */
export default function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next.length < 8) {
      setError("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.");
      return;
    }
    if (next !== confirm) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    setBusy(true);
    try {
      await apiMutate("/auth/change-password/", "POST", { current_password: current, new_password: next });
      setDone(true);
      // The flag lives on the server, so the layout only stops redirecting
      // once this page has been re-fetched.
      router.replace(DASHBOARD);
      router.refresh();
    } catch (err) {
      setError(describeApiError(err, "تعذّر تغيير كلمة المرور."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-[520px] flex-col gap-4 rounded-card border border-line bg-paper p-6">
      {forced && (
        <div role="status" className="rounded-card border border-gold bg-[#FDF6E3] px-4 py-3">
          <div className="mb-1 text-[14.5px] font-extrabold text-gold">اختر كلمة مرور خاصة بك</div>
          <p className="m-0 text-[14px] leading-[1.7] text-ink-2">
            دخلت بكلمة مرور مؤقتة أنشأها مدير الموقع. اختر كلمة مرور تعرفها وحدك للمتابعة إلى لوحة التحكم.
          </p>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-card border border-down bg-down-tint px-3.5 py-2.5 text-[13.5px] font-semibold text-down">
          {error}
        </div>
      )}
      {done && !error && (
        <div role="status" className="rounded-card border border-up bg-up-tint px-3.5 py-2.5 text-[13.5px] font-semibold text-up">
          تم تغيير كلمة المرور.
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-bold text-ink-2">{forced ? "كلمة المرور المؤقتة" : "كلمة المرور الحالية"}</span>
        <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={FIELD} required />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-bold text-ink-2">كلمة المرور الجديدة</span>
        <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={FIELD} required />
        <span className="text-[12.5px] text-ink-3">8 أحرف على الأقل.</span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-bold text-ink-2">تأكيد كلمة المرور</span>
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={FIELD} required />
      </label>

      <button
        type="submit"
        disabled={busy}
        className="rounded-card bg-brand px-5 py-2.5 text-[14.5px] font-bold text-paper disabled:opacity-60"
      >
        {busy ? "جارٍ الحفظ…" : "حفظ كلمة المرور"}
      </button>
    </form>
  );
}
