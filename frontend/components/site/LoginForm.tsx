"use client";

import Link from "next/link";
import { DASHBOARD } from "@/lib/routes";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { login, register } from "@/lib/api";

type Mode = "login" | "register";

/**
 * `?next=` decides where a successful sign-in lands, and it arrives in the
 * query string of a link anyone can send. Handed to router.push() unchecked,
 * it turns the genuine sign-in page into the first hop of a phishing chain:
 * the reader types their password on the real site, watches it succeed, and
 * arrives at a lookalike asking them to "confirm" it. Only a path on this
 * site is honoured; anything else falls back to the front page.
 *
 * The normalisation before the test matters as much as the test. Browsers
 * strip tab/LF/CR from a URL and read a backslash as a slash, so `/\evil.example`
 * and `/⇥/evil.example` reach the network as `//evil.example` — a host, not a
 * path — while a naive startsWith("/") waves both through.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw) return "/";
  const value = raw.replace(/[\t\n\r]/g, "").trim();
  if (!value.startsWith("/")) return "/"; // absolute URL, or any scheme
  // "//host" and "/\host" are both authority-relative, not paths.
  if (/^\/[/\\]/.test(value) || value.slice(0, 4).toLowerCase() === "/%5c") return "/";
  return value;
}

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const account = mode === "login" ? await login(email, password) : await register(email, password, name);
      // Staff land in the newsroom; readers go back where they came from.
      router.push(next !== "/" ? next : account.is_staff_member ? DASHBOARD : "/");
      router.refresh();
    } catch (err) {
      // ApiError.status, not a substring of its message: `includes("401")`
      // also matched a 401 sitting in the request path or an echoed field, so
      // a server that had fallen over told the reader their password was
      // wrong — and they retyped a password that was never the problem.
      setError(
        (err as { status?: number })?.status === 401
          ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
          : mode === "register"
            ? "تعذّر إنشاء الحساب. راجع البيانات وحاول مرة أخرى."
            : "تعذّر تسجيل الدخول. حاول مرة أخرى.",
      );
    } finally {
      setBusy(false);
    }
  };

  const isLogin = mode === "login";

  return (
    <form onSubmit={submit} className="w-full max-w-[420px] rounded-card border border-line bg-paper p-10 shadow-2">
      <div className="mb-2 rule-accent ps-3.5">
        <h1 className="font-display-ar m-0 text-h2 font-extrabold text-ink">
          {isLogin ? "تسجيل الدخول" : "حساب جديد"}
        </h1>
      </div>
      <p className="mb-6 text-[14px] text-ink-3">
        {isLogin ? "سجّل الدخول لمتابعة أخبارك واهتماماتك المفضلة" : "أنشئ حساباً لتتابع أقسامك وكتّابك المفضلين"}
      </p>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-down bg-down-tint px-3.5 py-2.5 text-[13px] font-semibold text-down">
          {error}
        </div>
      )}

      {!isLogin && (
        <>
          <label htmlFor="name" className="mb-1.5 block text-[13px] font-semibold text-ink-2">الاسم</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mb-4 w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-brand focus:bg-paper"
          />
        </>
      )}

      <label htmlFor="email" className="mb-1.5 block text-[13px] font-semibold text-ink-2">
        {isLogin ? "البريد الإلكتروني أو اسم المستخدم" : "البريد الإلكتروني"}
      </label>
      {/* Sign-in stays type="text": the API accepts an email or a username, and
          readers have emails while newsroom accounts are keyed by username —
          type="email" made the browser refuse to submit a valid staff login.
          Registration does want a real address, so it keeps the email type. */}
      <input
        id="email"
        type={isLogin ? "text" : "email"}
        required
        dir="ltr"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={isLogin ? "name@example.com أو اسم المستخدم" : "name@example.com"}
        className="mb-4 w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-start text-[14px] text-ink outline-none focus:border-brand focus:bg-paper"
      />

      <label htmlFor="password" className="mb-1.5 block text-[13px] font-semibold text-ink-2">كلمة المرور</label>
      <div className="relative mb-2">
        <input
          id="password"
          type={showPassword ? "text" : "password"}
          required
          autoComplete={isLogin ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 pe-10 text-[14px] text-ink outline-none focus:border-brand focus:bg-paper"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          className="absolute end-2.5 top-1/2 -translate-y-1/2 border-none bg-none text-[14px] text-ink-3"
        >
          {showPassword ? "🙈" : "👁"}
        </button>
      </div>

      <div className="mb-5 text-end">
        <Link href="/about" className="text-[13px] font-semibold text-brand no-underline">
          نسيت كلمة المرور؟
        </Link>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-pill bg-brand py-3 text-[15px] font-bold text-paper hover:bg-brand-strong disabled:opacity-60"
      >
        {busy ? "لحظة…" : isLogin ? "دخول" : "إنشاء الحساب"}
      </button>

      <p className="mt-5 text-center text-[13px] text-ink-3">
        {isLogin ? "ليس لديك حساب؟ " : "لديك حساب بالفعل؟ "}
        <button
          type="button"
          onClick={() => {
            setMode(isLogin ? "register" : "login");
            setError("");
          }}
          className="font-bold text-brand"
        >
          {isLogin ? "إنشاء حساب جديد" : "تسجيل الدخول"}
        </button>
      </p>
    </form>
  );
}
